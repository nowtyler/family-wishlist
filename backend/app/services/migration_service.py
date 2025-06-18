from alembic.config import Config
from alembic import command, autogenerate
from alembic.script import ScriptDirectory
from alembic.runtime.migration import MigrationContext
from sqlalchemy import create_engine, inspect, text
import os
import hashlib
import subprocess
import traceback
from datetime import datetime
from pathlib import Path
from typing import List, Dict, Tuple, Any, Union
from ..schemas import MigrationInfo
import logging
from .backup_service import BackupService
from ..database import Base
from ..models import *  # Import all models to register them with Base.metadata

logger = logging.getLogger(__name__)

# Add the template content at module level
SCRIPT_TEMPLATE = '''"""${message}

Revision ID: ${up_revision}
Revises: ${down_revision | comma,n}
Create Date: ${create_date}

"""
from alembic import op
import sqlalchemy as sa
${imports if imports else ""}

# revision identifiers, used by Alembic.
revision = ${repr(up_revision)}
down_revision = ${repr(down_revision)}
branch_labels = ${repr(branch_labels)}
depends_on = ${repr(depends_on)}


def upgrade() -> None:
    ${upgrades if upgrades else "pass"}


def downgrade() -> None:
    ${downgrades if downgrades else "pass"}
'''

class MigrationService:
    def __init__(self, db_url: str):
        self.db_url = db_url
        # Look for alembic.ini and script.py.mako
        config_paths = [
            '/app/alembic.ini',  # Docker path
            'alembic.ini',       # Local development path
            '../alembic.ini'     # Alternative local path
        ]
        
        self.alembic_cfg = None
        for config_path in config_paths:
            if os.path.exists(config_path):
                logger.info(f"Found alembic.ini at: {config_path}")
                self.alembic_cfg = Config(config_path)
                
                # Set SQLite-specific options
                self.alembic_cfg.set_main_option('render_as_batch', 'True')
                self.alembic_cfg.set_main_option('compare_type', 'True')
                
                # Also check for script template
                script_template = os.path.join(os.path.dirname(config_path), 'app', 'migrations', 'script.py.mako')
                if not os.path.exists(script_template):
                    logger.warning(f"Creating script template at: {script_template}")
                    os.makedirs(os.path.dirname(script_template), exist_ok=True)
                    with open(script_template, 'w') as f:
                        f.write(SCRIPT_TEMPLATE)
                break
        
        if not self.alembic_cfg:
            raise RuntimeError("Could not find alembic.ini in any of the expected locations")
            
        # Ensure the engine uses the correct URL
        self.engine = create_engine(db_url)
        self.alembic_cfg.set_main_option('sqlalchemy.url', db_url)
        self.backup_service = BackupService(db_url.replace('sqlite:///', ''))

    def get_current_version(self) -> str:
        """Get the current migration version from alembic, handling multiple heads"""
        try:
            with self.engine.connect() as connection:
                context = MigrationContext.configure(connection)
                current_heads = context.get_current_heads()
                
                if not current_heads:
                    return "base"  # No migrations applied
                elif len(current_heads) == 1:
                    return current_heads[0]  # Single head
                else:
                    # Multiple heads case - return comma-separated list
                    logger.warning(f"Multiple migration heads detected: {current_heads}")
                    return ",".join(current_heads)
        except Exception as e:
            logger.error(f"Error getting current version: {e}")
            traceback.print_exc()
            return "unknown"

    def detect_model_changes(self) -> bool:
        """
        Detect if there are pending model changes that should be migrated.
        Returns True if changes detected, False otherwise.
        """
        try:
            # Get the current hash from the metadata
            current_hash = self.get_schema_hash()
            
            # Connect to the database and get stored hash
            engine = create_engine(self.db_url)
            conn = engine.connect()
            try:
                # Check if schema_version table exists
                result = conn.execute(text(
                    "SELECT name FROM sqlite_master WHERE type='table' AND name='schema_version'"
                ))
                if not result.fetchone():
                    # Check if system_settings has the schema_hash field
                    try:
                        settings_result = conn.execute(text(
                            "SELECT schema_hash FROM system_settings WHERE id = 1"
                        ))
                        row = settings_result.fetchone()
                        stored_hash = row[0] if row else None
                        
                        # If we found a hash in system_settings, compare it
                        if stored_hash and stored_hash == current_hash:
                            return False
                    except Exception:
                        pass  # Silently continue if no system_settings table
                        
                    # Neither schema_version nor valid system_settings.schema_hash exist
                    return True
                
                # Get stored hash from schema_version
                try:
                    result = conn.execute(text("SELECT hash FROM schema_version LIMIT 1"))
                    row = result.fetchone()
                    stored_hash = row[0] if row else None
                except Exception:
                    # Check system_settings as fallback
                    try:
                        settings_result = conn.execute(text(
                            "SELECT schema_hash FROM system_settings WHERE id = 1"
                        ))
                        row = settings_result.fetchone()
                        stored_hash = row[0] if row else None
                    except Exception:
                        # No valid hash found in either table
                        return True
            finally:
                conn.close()
            
            # If we got this far and still don't have a stored hash, consider it a change
            if not stored_hash:
                # Debug log the hashes for troubleshooting
                logger.debug(f"No stored schema hash found - Current: {current_hash}")
                return True
                
            # Compare hashes - if they match, no need for migration
            if stored_hash == current_hash:
                # Check version only if hashes match
                if self.alembic_cfg is not None:
                    try:
                        script = ScriptDirectory.from_config(self.alembic_cfg)
                        current = self.get_current_version()
                        head = script.get_current_head()
                        
                        # If current version is not at head, consider it needs upgrade
                        if current != head and current != "base" and "," not in current:
                            logger.debug(f"Database version not at head - Current: {current}, Head: {head}")
                            return True
                    except Exception as e:
                        logger.warning(f"Error checking alembic versions: {e}")
                
                # Hashes match and no version issue
                return False
            
            # Hashes don't match - debug log and check versions
            logger.debug(f"Schema hashes don't match - Stored: {stored_hash}, Current: {current_hash}")
            
            # Check if we just need to update the hash by verifying version is current
            if self.alembic_cfg is not None:
                try:
                    script = ScriptDirectory.from_config(self.alembic_cfg)
                    current = self.get_current_version()
                    head = script.get_current_head()
                    
                    # If we're at the head version, we can update the hash
                    if current == head:
                        logger.info("Schema hash mismatch but version is at head. Updating hash to match.")
                        self.reset_schema_hash()
                        return False
                except Exception as e:
                    logger.warning(f"Error checking alembic versions during hash mismatch: {e}")
                    
            # If we got here, hashes don't match and we couldn't verify that we're at head version
            # This indicates we likely need migration
                    self.reset_schema_hash()  # Update hash to avoid future false positives
                    return False
                    
                return True
            
            # Check for pending migrations separately by using Alembic
            try:
                script = ScriptDirectory.from_config(self.alembic_cfg)
                current = self.get_current_version()
                head = script.get_current_head()
                
                # If current version is not at head, consider it needs upgrade
                if current != head and current != "base":
                    logger.debug(f"Database version not at head - Current: {current}, Head: {head}")
                    return True
            except Exception as e:
                logger.warning(f"Error checking alembic versions: {e}")
                # Don't return True here, fall through to final check
                
            # Hashes match and no pending migrations
            return False
            
        except Exception as e:
            logger.error(f"Error detecting model changes: {e}")
            traceback.print_exc()
            # In case of error, we should NOT assume changes are needed
            # This prevents false positives during errors
            return False

    def sqlite_on_connect(self, dbapi_connection, connection_record):
        """Enable SQLite foreign key support and other optimizations"""
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.execute("PRAGMA synchronous=NORMAL")
        cursor.execute("PRAGMA journal_mode=WAL")
        cursor.close()

    def get_available_migrations(self) -> List[MigrationInfo]:
        try:
            has_changes = self.detect_model_changes()
            script = ScriptDirectory.from_config(self.alembic_cfg)
            current = self.get_current_version()
            
            migrations = []
            
            # Only add pending changes if actual changes are detected
            if has_changes:
                migrations.append(MigrationInfo(
                    version="pending",
                    description="Pending model changes detected - Click upgrade to apply",
                    applied=False
                ))

            # Add existing migrations
            for sc in script.walk_revisions():
                # Skip already applied migrations for cleaner display
                if current and sc.revision <= current:
                    continue
                    
                migrations.append(MigrationInfo(
                    version=sc.revision,
                    description=sc.doc,
                    applied=sc.revision <= current if current else False
                ))
            
            return sorted(migrations, key=lambda x: x.version if x.version != "pending" else "zzz")
        except Exception as e:
            logger.error(f"Error getting migrations: {e}")
            return []

    def is_foundation_database(self) -> bool:
        """Check if this is the foundation database"""
        try:
            with self.engine.connect() as connection:
                # First check if the table exists
                inspector = inspect(self.engine)
                if 'system_settings' not in inspector.get_table_names():
                    return False
                    
                # Check if the column exists
                has_foundation_column = False
                for column in inspector.get_columns('system_settings'):
                    if column['name'] == 'is_foundation':
                        has_foundation_column = True
                        break
                        
                if not has_foundation_column:
                    return False
                    
                # Finally check the value
                result = connection.execute(text(
                    "SELECT is_foundation FROM system_settings WHERE id = 1"
                )).scalar()
                return bool(result)
        except Exception as e:
            logger.error(f"Error checking foundation status: {e}")
            return False

    def merge_heads(self) -> str:
        """Merge multiple migration heads"""
        try:
            current_version = self.get_current_version()
            if "," not in current_version:
                return f"No multiple heads to merge: {current_version}"
                
            heads = current_version.split(",")
            logger.info(f"Attempting to merge heads: {heads}")
            
            # Find alembic executable path
            alembic_path = "alembic"  # Default assumption
            try:
                # Try to find alembic in common locations
                for path in ["/usr/local/bin/alembic", "/usr/bin/alembic", "alembic"]:
                    result = subprocess.run(["which", path], capture_output=True, text=True)
                    if result.returncode == 0:
                        alembic_path = path
                        break
            except Exception:
                pass  # Fall back to default "alembic"
            
            # Use full alembic command with proper config file
            config_path = self.alembic_cfg.config_file_name
            command = [
                alembic_path,
                "-c", config_path,
                "merge",
                "-m", f"Merge branches {current_version}"
            ]
            command.extend(heads)
            
            logger.info(f"Running merge command: {' '.join(command)}")
            result = subprocess.run(
                command,
                capture_output=True,
                text=True,
                check=True
            )
            
            # Get the new migration revision from the output
            merge_revision = None
            output = result.stdout
            logger.info(f"Merge result: {output}")
            
            # Extract the revision ID from the output
            import re
            match = re.search(r"Generating .+?/([a-f0-9]+)_merge", output)
            if match:
                merge_revision = match.group(1)
                logger.info(f"Extracted merge revision: {merge_revision}")
            
            # Now apply this merge migration immediately
            if merge_revision:
                # Run the upgrade to the merge revision
                upgrade_cmd = [
                    alembic_path,
                    "-c", config_path,
                    "upgrade", merge_revision
                ]
                logger.info(f"Running upgrade to merge revision: {' '.join(upgrade_cmd)}")
                upgrade_result = subprocess.run(upgrade_cmd, capture_output=True, text=True, check=True)
                logger.info(f"Upgrade result: {upgrade_result.stdout}")
                
            return f"Successfully merged heads: {current_version}"
            
        except subprocess.CalledProcessError as e:
            error_msg = f"Merge failed: {e.stderr}"
            logger.error(error_msg)
            return error_msg
        except Exception as e:
            error_msg = f"Merge error: {str(e)}"
            logger.error(error_msg)
            traceback.print_exc()
            return error_msg

    def upgrade(self, target: str = "head") -> str:
        """Upgrades database to target version with SQLite compatibility"""
        try:
            # Create backup before upgrading
            backup_path = self.backup_service.create_backup()
            logger.info(f"Created backup at {backup_path}")
            
            current_version = self.get_current_version()
            logger.info(f"Current version before upgrade: {current_version}")
            
            # Handle multiple heads case first by forcing a merge
            if "," in current_version:
                logger.warning("Multiple heads detected, attempting to merge them first")
                merge_result = self.merge_heads()
                logger.info(f"Merge result: {merge_result}")
                
                # Check if merge was successful by getting current version again
                new_current = self.get_current_version()
                logger.info(f"Version after merge attempt: {new_current}")
                if "," in new_current:
                    # If we still have multiple heads after merge, try direct SQL fix
                    try:
                        logger.warning("Merge didn't resolve multiple heads, trying direct database fix")
                        with self.engine.begin() as connection:
                            # Get the latest revision
                            latest_rev = new_current.split(',')[0]  # Just take the first one
                            # Update the alembic_version table to use only this revision
                            connection.execute(text("DELETE FROM alembic_version"))
                            connection.execute(
                                text("INSERT INTO alembic_version (version_num) VALUES (:rev)"),
                                {'rev': latest_rev}
                            )
                            logger.info(f"Forced alembic_version to {latest_rev}")
                            
                            # Confirm the change
                            context = MigrationContext.configure(connection)
                            heads = context.get_current_heads()
                            logger.info(f"Current heads after direct fix: {heads}")
                            new_current = heads[0] if heads else 'base'
                            
                            # If we have just 'base', create a new migration to get us to a good state
                            if new_current == 'base':
                                logger.info("Database reset to 'base', will create new migration")
                                return self.upgrade(target)  # Recursive call to create new migration
                                
                    except Exception as e:
                        logger.error(f"Error in direct database fix: {e}")
                        return f"Failed to merge heads. Please resolve manually. Current heads: {new_current}"
            
            # Store current schema hash before migration
            pre_migration_hash = self.get_schema_hash()
            
            # Make sure alembic_version is properly set up
            with self.engine.begin() as connection:
                try:
                    connection.execute(text("SELECT version_num FROM alembic_version"))
                except Exception:
                    logger.info("Creating alembic_version table")
                    connection.execute(text(
                        "CREATE TABLE IF NOT EXISTS alembic_version (version_num VARCHAR(32))"
                    ))
                    if current_version == "base" or current_version == "unknown":
                        connection.execute(text("INSERT INTO alembic_version (version_num) VALUES ('base')"))
        
            # Check for model changes and create migrations if needed
            if self.detect_model_changes():
                logger.info("Creating new migration for detected changes")
                try:
                    revision_result = self.create_migration("Auto-generated migration for model changes")
                    logger.info(f"Created new migration: {revision_result}")
                except Exception as e:
                    logger.error(f"Error creating migration: {e}")
                    traceback.print_exc()
        
            # Run the actual migration
            logger.info(f"Running upgrade to {target}")
            try:
                command.upgrade(self.alembic_cfg, target)
                logger.info("Upgrade command completed successfully")
            except Exception as e:
                logger.error(f"Upgrade command error: {e}")
                traceback.print_exc()
                # Try one more approach - execute alembic directly
                try:
                    logger.info("Attempting direct alembic command as fallback")
                    alembic_cmd = ["alembic", "-c", self.alembic_cfg.config_file_name, "upgrade", target]
                    logger.info(f"Executing: {' '.join(alembic_cmd)}")
                    result = subprocess.run(alembic_cmd, capture_output=True, text=True, check=False)
                    if result.returncode != 0:
                        return f"Failed to upgrade: {result.stderr}"
                    logger.info(f"Direct alembic upgrade result: {result.stdout}")
                except Exception as fallback_error:
                    logger.error(f"Fallback approach also failed: {fallback_error}")
                    return f"Failed to upgrade using all methods: {str(e)} and {str(fallback_error)}"
                
            # Get final version and verify success
            new_version = self.get_current_version()
            logger.info(f"Successfully upgraded to {new_version}")
            
            # Verify that we don't still have multiple heads
            if "," in new_version:
                logger.warning(f"Still have multiple heads after upgrade: {new_version}")
                # Try one more direct fix
                try:
                    with self.engine.begin() as conn:
                        latest_rev = new_version.split(',')[-1]  # Get the last one this time
                        conn.execute(text("DELETE FROM alembic_version"))
                        conn.execute(text("INSERT INTO alembic_version (version_num) VALUES (:rev)"), {'rev': latest_rev})
                        logger.info(f"Final fix: forced alembic_version to {latest_rev}")
                        new_version = latest_rev
                except Exception as e:
                    logger.error(f"Final fix error: {e}")
            
            # Update schema hash in system_settings
            try:
                post_migration_hash = self.get_schema_hash()
                if pre_migration_hash != post_migration_hash:
                    logger.info(f"Schema hash changed: {pre_migration_hash[:8]}... -> {post_migration_hash[:8]}...")
                    with self.engine.begin() as conn:
                        conn.execute(text(
                            "UPDATE system_settings SET schema_hash = :hash, last_updated = CURRENT_DATE WHERE id = 1"
                        ), {"hash": post_migration_hash})
            except Exception as e:
                logger.warning(f"Failed to update schema hash: {e}")
            
            # Force metadata refresh
            Base.metadata.clear()
            Base.metadata.reflect(bind=self.engine)
            
            return f"Successfully upgraded database from {current_version} to {new_version} (Backup: {os.path.basename(backup_path)})"
                
        except Exception as e:
            error_msg = f"Migration error: {str(e)}\n{traceback.format_exc()}"
            logger.error(error_msg)
            return f"Failed to upgrade: {str(e)}"

    def downgrade(self, target: str) -> str:
        """Downgrades database to target version"""
        try:
            command.downgrade(self.alembic_cfg, target)
            return f"Successfully downgraded to {target}"
        except Exception as e:
            return f"Failed to downgrade: {str(e)}"
    
    def get_schema_hash(self) -> str:
        """Generate a hash of the current schema definition"""
        try:
            from sqlalchemy.schema import CreateTable
            schema_def = []
            
            # Get table definitions from metadata
            for table in Base.metadata.sorted_tables:
                create_stmt = str(CreateTable(table).compile(self.engine))
                schema_def.append(create_stmt)
            
            schema_str = '\n'.join(sorted(schema_def))
            return hashlib.sha256(schema_str.encode()).hexdigest()
        except Exception as e:
            logger.error(f"Error generating schema hash: {e}")
            return "error_generating_hash"

    def schema_requires_migration(self, target_hash: str) -> bool:
        """Check if current schema matches target hash"""
        current_hash = self.get_schema_hash()
        return current_hash != target_hash

    def delete_migration(self, version: str) -> Tuple[bool, str]:
        """Delete a migration file with safeguards"""
        try:
            script = ScriptDirectory.from_config(self.alembic_cfg)
            versions_dir = os.path.join(os.path.dirname(script.dir), "migrations", "versions")
            
            # Get current version and its dependencies
            current = self.get_current_version()
            if current == version:
                return False, "Cannot delete current version"
                
            # Get all migrations in the chain
            migration_chain = set()
            def get_chain(rev):
                if not rev or rev == 'base':
                    return
                sc = script.get_revision(rev)
                if sc:
                    migration_chain.add(sc.revision)
                    for dep in sc.dependencies:
                        get_chain(dep)
            
            get_chain(current)
            
            # Protect migrations in the active chain
            if version in migration_chain:
                return False, "Cannot delete migration in active chain"
                
            # Find and delete the migration file
            for filename in os.listdir(versions_dir):
                if filename.startswith(version) and filename.endswith('.py'):
                    file_path = os.path.join(versions_dir, filename)
                    os.remove(file_path)
                    # Also remove the .pyc file if it exists
                    pyc_file = file_path + 'c'
                    if os.path.exists(pyc_file):
                        os.remove(pyc_file)
                    return True, f"Migration {version} deleted successfully"
            
            return False, f"Migration {version} not found"
        except Exception as e:
            logger.error(f"Error deleting migration: {e}")
            return False, f"Error deleting migration: {str(e)}"

    def reset_migration_state(self) -> str:
        """Reset the migration state for fresh start"""
        try:
            with self.engine.begin() as conn:
                # Drop the alembic_version table and recreate it
                conn.execute(text("DROP TABLE IF EXISTS alembic_version"))
                conn.execute(text("CREATE TABLE alembic_version (version_num VARCHAR(32))"))
                conn.execute(text("INSERT INTO alembic_version (version_num) VALUES ('base')"))
                
            return "Migration state reset successfully"
        except Exception as e:
            error_msg = f"Failed to reset migration state: {str(e)}"
            logger.error(error_msg)
            traceback.print_exc()
            return error_msg

    def create_migration(self, message: str) -> str:
        """Create a new migration with the given message"""
        try:
            # Create a revision with autogenerate=True to detect model changes
            from alembic.command import revision
            
            # Make sure the message is safe
            safe_message = message.replace("'", "").replace('"', "").replace(";", "")
            
            # Log the migration creation attempt
            logger.info(f"Creating migration with message: {safe_message}")
            
            # Call the alembic revision command
            revision(
                self.alembic_cfg,
                message=safe_message,
                autogenerate=True
            )
            
            # Get the latest revision after creation
            script_directory = ScriptDirectory.from_config(self.alembic_cfg)
            current_head = script_directory.get_current_head()
            
            return f"Successfully created migration: {current_head}"
        except Exception as e:
            error_msg = f"Failed to create migration: {str(e)}"
            logger.error(error_msg)
            traceback.print_exc()
            return error_msg

    def reset_schema_hash(self) -> bool:
        """
        Reset the schema hash in the database to match the current model state.
        This helps resolve situations where the system incorrectly thinks migrations are needed.
        
        Returns True if reset was successful, False otherwise
        """
        try:
            current_hash = self.get_schema_hash()
            
            # Connect to the database and reset the hash
            engine = create_engine(self.db_url)
            conn = engine.connect()
            transaction = conn.begin()
            
            try:
                # Check if schema_version table exists
                result = conn.execute(text(
                    "SELECT name FROM sqlite_master WHERE type='table' AND name='schema_version'"
                ))
                
                if not result.fetchone():
                    # Create the table if it doesn't exist
                    conn.execute(text(
                        "CREATE TABLE schema_version (hash TEXT, updated_at TIMESTAMP)"
                    ))
                
                # Delete any existing entries
                conn.execute(text("DELETE FROM schema_version"))
                
                # Insert new hash
                conn.execute(text(
                    "INSERT INTO schema_version (hash, updated_at) VALUES (:hash, :updated_at)"
                ), {"hash": current_hash, "updated_at": datetime.utcnow()})
                
                # Also update system_settings if it exists and has schema_hash column
                try:
                    conn.execute(text("UPDATE system_settings SET schema_hash = :hash WHERE id = 1"), {"hash": current_hash})
                    logger.info("Updated schema_hash in system_settings")
                except Exception:
                    logger.debug("Could not update schema_hash in system_settings - may not exist")
                
                transaction.commit()
                logger.info(f"Schema hash reset to: {current_hash}")
                return True
            except Exception as e:
                transaction.rollback()
                logger.error(f"Failed to reset schema hash: {e}")
                return False
            finally:
                conn.close()
                
        except Exception as e:
            logger.error(f"Error resetting schema hash: {e}")
            return False
