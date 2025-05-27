import os
import shutil
from datetime import datetime
import logging
from typing import List, Tuple, Optional
from sqlalchemy import create_engine, inspect, text
from ..schemas import BackupInfo
from pathlib import Path

logger = logging.getLogger(__name__)

class BackupService:
    def __init__(self, db_path: str):
        self.db_path = db_path
        self.backup_dir = os.path.join(os.path.dirname(db_path), 'backups')
        os.makedirs(self.backup_dir, exist_ok=True)
        self.engine = create_engine(f'sqlite:///{db_path}')

    def create_backup(self, manual: bool = False) -> str:
        """Creates a backup of the database"""
        try:
            timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
            prefix = 'manual' if manual else 'auto'
            backup_path = os.path.join(self.backup_dir, f'{prefix}_{timestamp}.db')
            shutil.copy2(self.db_path, backup_path)
            logger.info(f"Created backup at {backup_path}")
            return backup_path
        except Exception as e:
            logger.error(f"Backup failed: {str(e)}")
            raise

    def get_backups(self) -> List[BackupInfo]:
        """Returns list of available backups with metadata"""
        backups = []
        for filename in os.listdir(self.backup_dir):
            if filename.endswith('.db'):
                path = os.path.join(self.backup_dir, filename)
                stats = os.stat(path)
                created = datetime.fromtimestamp(stats.st_ctime)
                size_kb = stats.st_size / 1024
                can_restore = self.check_schema_compatibility(path)
                
                backups.append(BackupInfo(
                    filename=filename,
                    created_at=created,
                    size_kb=size_kb,
                    can_restore=can_restore
                ))
        
        return sorted(backups, key=lambda x: x.created_at, reverse=True)

    def check_schema_compatibility(self, backup_path: str) -> bool:
        """Checks if backup database schema matches current schema"""
        try:
            backup_engine = create_engine(f'sqlite:///{backup_path}')
            
            # Fix the query execution
            try:
                with backup_engine.connect() as conn:
                    conn.execute(text("SELECT 1"))  # Use SQLAlchemy text() for raw SQL
                    conn.commit()  # Make sure to commit the transaction
                return True
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
            
            # Stop database connections
            with self.engine.connect() as connection:
                connection.execute(text("PRAGMA wal_checkpoint(FULL)"))
                
            # Restore the backup
            shutil.copy2(backup_path, self.db_path)
            logger.info(f"Successfully restored from backup: {backup_filename}")
            return True, "Database restored successfully"
        except Exception as e:
            error_msg = f"Restore failed: {str(e)}"
            logger.error(error_msg)
            return False, error_msg

    def delete_backup(self, backup_filename: str) -> Tuple[bool, str]:
        """Deletes a backup file"""
        try:
            backup_path = os.path.join(self.backup_dir, backup_filename)
            if not os.path.exists(backup_path):
                return False, "Backup file not found"
            
            os.remove(backup_path)
            return True, "Backup deleted successfully"
        except Exception as e:
            return False, f"Failed to delete backup: {str(e)}"
            return False, f"Failed to delete backup: {str(e)}"
