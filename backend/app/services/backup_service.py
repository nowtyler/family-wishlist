import os
import shutil
from datetime import datetime
import logging
from typing import List, Tuple, Optional
from sqlalchemy import create_engine, inspect, text
from ..schemas import BackupInfo
from pathlib import Path
import json
import pytz  # Add this import for timezone support

logger = logging.getLogger(__name__)

class BackupService:
    def __init__(self, db_path: str):
        self.db_path = db_path
        # Always use /app/data/backups inside container
        self.backup_dir = "/app/data/backups"
        os.makedirs(self.backup_dir, exist_ok=True)
        logger.info(f"Using backup directory: {self.backup_dir}")
        self.engine = create_engine(f'sqlite:///{db_path}')

    def create_backup(self, manual: bool = False) -> str:
        """Creates a backup of the database"""
        try:
            # Use EST timezone for timestamps
            eastern = pytz.timezone('US/Eastern')
            timestamp = datetime.now(eastern).strftime('%Y%m%d_%H%M%S')
            prefix = 'manual' if manual else 'auto'
            backup_path = os.path.join(self.backup_dir, f'{prefix}_{timestamp}.db')
            
            # Create backup metadata file
            metadata_path = backup_path + '.meta'
            
            # Get current Alembic version and foundation status
            version = "unknown"
            is_foundation = False
            try:
                with self.engine.connect() as conn:
                    # Get alembic version
                    try:
                        result = conn.execute(text("SELECT version_num FROM alembic_version LIMIT 1"))
                        row = result.fetchone()
                        if row:
                            version = row[0]
                    except Exception as e:
                        logger.warning(f"Could not get alembic version: {e}")
                    
                    # Check foundation status
                    try:
                        result = conn.execute(text("SELECT is_foundation FROM system_settings LIMIT 1"))
                        row = result.fetchone()
                        if row:
                            is_foundation = bool(row[0])
                    except Exception as e:
                        logger.warning(f"Could not get foundation status: {e}")
                        
            except Exception as e:
                logger.error(f"Error getting database metadata: {e}")

            # Store metadata
            with open(metadata_path, 'w') as f:
                json.dump({
                    'version': version,
                    'timestamp': timestamp,
                    'manual': manual,
                    'is_foundation': is_foundation
                }, f)

            shutil.copy2(self.db_path, backup_path)
            logger.info(f"Created backup at {backup_path} (version: {version}, foundation: {is_foundation})")
            return backup_path
        except Exception as e:
            logger.error(f"Backup failed: {str(e)}")
            raise

    def get_backups(self) -> List[BackupInfo]:
        """Returns list of available backups with metadata"""
        backups = []
        eastern = pytz.timezone('US/Eastern')  # Define EST timezone
        
        for filename in os.listdir(self.backup_dir):
            if filename.endswith('.db'):
                path = os.path.join(self.backup_dir, filename)
                stats = os.stat(path)
                # Convert creation time to EST
                created_utc = datetime.fromtimestamp(stats.st_ctime)
                created = created_utc.astimezone(eastern)
                size_kb = stats.st_size / 1024
                can_restore = self.check_schema_compatibility(path)
                
                # Try to read metadata file
                version = "unknown"
                metadata_path = path + '.meta'
                if os.path.exists(metadata_path):
                    try:
                        with open(metadata_path, 'r') as f:
                            metadata = json.load(f)
                            version = metadata.get('version', 'unknown')
                    except Exception as e:
                        logger.error(f"Error reading backup metadata: {e}")
                
                backups.append(BackupInfo(
                    filename=filename,
                    created_at=created,
                    size_kb=size_kb,
                    can_restore=can_restore,
                    version=version
                ))
        
        return sorted(backups, key=lambda x: x.created_at, reverse=True)

    def check_schema_compatibility(self, backup_path: str) -> bool:
        """Check if backup database is upgradeable"""
        try:
            backup_engine = create_engine(f'sqlite:///{backup_path}')
            
            # First check if we can connect
            try:
                with backup_engine.connect() as conn:
                    conn.execute(text("SELECT 1"))  # Basic connectivity test
                    # Check for alembic version table
                    result = conn.execute(text("SELECT name FROM sqlite_master WHERE type='table' AND name='alembic_version'"))
                    has_alembic = result.scalar() is not None
                    if not has_alembic:
                        logger.warning("Backup has no alembic_version table - might be from older version")
                        return True  # Allow restore and migration
                    return True  # Database is valid and can be migrated if needed
            except Exception as e:
                logger.error(f"Failed to connect to backup database: {str(e)}")
                return False
                
        except Exception as e:
            logger.error(f"Schema check failed: {str(e)}")
            return False

    def restore_from_backup(self, backup_filename: str) -> Tuple[bool, str]:
        """Restores database from backup"""
        backup_path = os.path.join(self.backup_dir, backup_filename)
        if not os.path.exists(backup_path):
            return False, "Backup file not found"
        
        try:
            # Create a backup of current state first
            pre_restore_backup = self.create_backup(manual=False)
            logger.info(f"Created pre-restore backup at: {pre_restore_backup}")

            # First, close all active connections to the database
            with self.engine.connect() as connection:
                connection.execute(text("PRAGMA wal_checkpoint(FULL)"))
            
            # Read metadata for version info
            version = "unknown"
            backup_version = "unknown"
            needs_migration = False
            metadata_path = backup_path + '.meta'
            if os.path.exists(metadata_path):
                try:
                    with open(metadata_path, 'r') as f:
                        metadata = json.load(f)
                        backup_version = metadata.get('version', 'unknown')
                        
                        # Check if the current version differs from the backup version
                        try:
                            with self.engine.connect() as conn:
                                result = conn.execute(text("SELECT version_num FROM alembic_version LIMIT 1"))
                                row = result.fetchone()
                                if row:
                                    version = row[0]
                        except Exception:
                            pass
                        
                        needs_migration = backup_version != version and backup_version != "unknown"
                except Exception as e:
                    logger.warning(f"Error reading backup metadata: {e}")
            
            # Restore the backup regardless of version
            shutil.copy2(backup_path, self.db_path)
            logger.info(f"Successfully restored from backup: {backup_filename}")
            
            # Reset the alembic_version table to be safe if it's an older backup
            try:
                with self.engine.begin() as conn:
                    conn.execute(text("DROP TABLE IF EXISTS alembic_version"))
                    conn.execute(text("CREATE TABLE alembic_version (version_num VARCHAR(32))"))
                    if backup_version != "unknown":
                        conn.execute(text(
                            "INSERT INTO alembic_version (version_num) VALUES (:version)"
                        ), {"version": backup_version})
                    else:
                        conn.execute(text("INSERT INTO alembic_version (version_num) VALUES ('base')"))
                    logger.info(f"Reset alembic_version table to: {backup_version or 'base'}")
            except Exception as e:
                logger.error(f"Failed to reset alembic_version: {e}")
            
            return True, f"Database restored successfully from {backup_filename} (version: {backup_version})"
        except Exception as e:
            error_msg = f"Restore failed: {str(e)}"
            logger.error(error_msg)
            return False, error_msg

    def delete_backup(self, backup_filename: str) -> Tuple[bool, str]:
        """Deletes a backup file and its corresponding .meta file if it exists"""
        try:
            backup_path = os.path.join(self.backup_dir, backup_filename)
            if not os.path.exists(backup_path):
                return False, "Backup file not found"
            
            # Delete the backup file
            os.remove(backup_path)
            
            # Check for and delete the corresponding metadata file
            meta_path = backup_path + '.meta'
            if os.path.exists(meta_path):
                os.remove(meta_path)
                logger.info(f"Deleted metadata file: {meta_path}")
            
            return True, "Backup and associated metadata deleted successfully"
        except Exception as e:
            return False, f"Failed to delete backup: {str(e)}"
