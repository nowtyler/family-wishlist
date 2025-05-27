from alembic.config import Config
from alembic import command
from alembic.script import ScriptDirectory
from alembic.runtime.migration import MigrationContext
from sqlalchemy import create_engine, inspect
import os
import hashlib
from typing import List, Dict, Tuple
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
        with self.engine.connect() as connection:
            context = MigrationContext.configure(connection)
            return context.get_current_revision() or "base"

    def detect_model_changes(self) -> bool:
        """Check if there are any model changes that need migration"""
        try:
            from alembic.autogenerate.compare import compare_metadata
            script = ScriptDirectory.from_config(self.alembic_cfg)
            
            with self.engine.connect() as connection:
                context = MigrationContext.configure(
                    connection,
                    opts={
                        'compare_type': True,
                        'compare_server_default': True,
                        'target_metadata': Base.metadata,
                        'include_schemas': True,
                        'render_as_batch': True,
                        'sqlite_on_connect': self.sqlite_on_connect,
                    }
                )
                
                # Get the diff using compare_metadata
                diff = compare_metadata(context, Base.metadata)
                if diff:
                    logger.info(f"Detected schema changes: {diff}")
                return bool(diff)
        except Exception as e:
            logger.error(f"Error detecting model changes: {e}")
            return True  # Return True on error to force checking

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
            
            # Add pending model changes as a virtual migration if detected
            if has_changes:
                migrations.append(MigrationInfo(
                    version="pending",
                    description="Pending model changes detected - Click upgrade to apply",
                    applied=False
                ))

            # Add existing migrations
            for sc in script.walk_revisions():
                migrations.append(MigrationInfo(
                    version=sc.revision,
                    description=sc.doc,
                    applied=sc.revision <= current if current else False
                ))
            
            return sorted(migrations, key=lambda x: x.version if x.version != "pending" else "zzz")
        except Exception as e:
            logger.error(f"Error getting migrations: {e}")
            return []

    def upgrade(self, target: str = "head") -> str:
        """Upgrades database to target version with SQLite compatibility"""
        try:
            # Create backup before upgrading
            backup_path = self.backup_service.create_backup()
            logger.info(f"Created backup at {backup_path}")
            
            if target == "pending" or self.detect_model_changes():
                # Configure for SQLite batch operations
                script = ScriptDirectory.from_config(self.alembic_cfg)
                
                with self.engine.connect() as connection:
                    context = MigrationContext.configure(
                        connection,
                        opts={
                            'compare_type': True,
                            'compare_server_default': True,
                            'target_metadata': Base.metadata,
                            'include_schemas': True,
                            'render_as_batch': True,
                            'transaction_per_migration': True,
                        }
                    )

                    # Create migration script
                    revision = command.revision(
                        self.alembic_cfg,
                        message="auto generated migration",
                        autogenerate=True
                    )

                    # Apply migration with batch operations
                    command.upgrade(
                        self.alembic_cfg,
                        "head",
                        sql=False,
                        tag=None
                    )
                    
                return f"Successfully created and applied auto-migration (Backup: {os.path.basename(backup_path)})"
            else:
                command.upgrade(self.alembic_cfg, target)
                return f"Successfully upgraded to {target} (Backup: {os.path.basename(backup_path)})"

        except Exception as e:
            logger.error(f"Migration error: {str(e)}")
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
        """Delete a migration file"""
        try:
            script = ScriptDirectory.from_config(self.alembic_cfg)
            versions_dir = os.path.join(os.path.dirname(script.dir), "migrations", "versions")
            
            # Create versions directory if it doesn't exist
            os.makedirs(versions_dir, exist_ok=True)
            
            # Find the migration file
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
