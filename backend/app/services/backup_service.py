import os
import shutil
from datetime import datetime
import logging
from typing import List, Tuple, Optional
from sqlalchemy import create_engine, inspect
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
            current_tables = set(inspect(self.engine).get_table_names())
            backup_tables = set(inspect(backup_engine).get_table_names())
            
            if current_tables != backup_tables:
                return False
            
            # Check columns in each table
            for table in current_tables:
                current_cols = {c['name']: c['type'] for c in inspect(self.engine).get_columns(table)}
                backup_cols = {c['name']: c['type'] for c in inspect(backup_engine).get_columns(table)}
                if current_cols != backup_cols:
                    return False
            
            return True
        except Exception as e:
            logger.error(f"Schema check failed: {str(e)}")
            return False

    def restore_from_backup(self, backup_filename: str) -> Tuple[bool, str]:
        """Restores database from backup"""
        backup_path = os.path.join(self.backup_dir, backup_filename)
        if not os.path.exists(backup_path):
            return False, "Backup file not found"
        
        if not self.check_schema_compatibility(backup_path):
            return False, "Schema mismatch - migration required"
        
        try:
            # Create a backup of current state first
            self.create_backup(manual=False)
            
            # Restore the backup
            shutil.copy2(backup_path, self.db_path)
            return True, "Database restored successfully"
        except Exception as e:
            logger.error(f"Restore failed: {str(e)}")
            return False, f"Restore failed: {str(e)}"
