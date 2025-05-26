from alembic.config import Config
from alembic import command
from alembic.script import ScriptDirectory
from alembic.runtime.migration import MigrationContext
from sqlalchemy import create_engine, inspect
import os
import hashlib
from typing import List, Dict
from ..schemas import MigrationInfo
import logging
from .backup_service import BackupService

logger = logging.getLogger(__name__)

class MigrationService:
    def __init__(self, db_url: str):
        self.db_url = db_url
        # Look for alembic.ini in the app root directory
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

    def get_available_migrations(self) -> List[MigrationInfo]:
        script = ScriptDirectory.from_config(self.alembic_cfg)
        current = self.get_current_version()
        
        migrations = []
        for sc in script.walk_revisions():
            migrations.append(MigrationInfo(
                version=sc.revision,
                description=sc.doc,
                applied=sc.revision <= current if current else False
            ))
        
        return sorted(migrations, key=lambda x: x.version)

    def create_migration(self, message: str) -> str:
        """Creates a new migration file"""
        try:
            # Ensure migrations directory exists
            os.makedirs(os.path.join("app", "migrations", "versions"), exist_ok=True)
            # Create new migration
            revision = command.revision(
                self.alembic_cfg,
                message=message,
                autogenerate=True
            )
            return f"Created migration {revision}"
        except Exception as e:
            return f"Failed to create migration: {str(e)}"

    def upgrade(self, target: str = "head") -> str:
        """Upgrades database to target version"""
        try:
            # Create backup before upgrading
            backup_path = self.backup_service.create_backup()
            logger.info(f"Created backup at {backup_path}")
            
            command.upgrade(self.alembic_cfg, target)
            return f"Successfully upgraded to {target} (Backup created: {os.path.basename(backup_path)})"
        except Exception as e:
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
        schema_def = []
        inspector = inspect(self.engine)
        
        # Get all tables
        for table_name in sorted(inspector.get_table_names()):  # Sort table names
            # Get columns
            columns = inspector.get_columns(table_name)
            col_info = sorted(  # Sort column info
                [(col['name'], str(col['type']), col.get('nullable', True)) 
                 for col in columns],
                key=lambda x: x[0]  # Sort by column name
            )
            
            # Get foreign keys and sort them
            foreign_keys = sorted(
                [(fk['referred_table'], tuple(sorted(fk['constrained_columns'])), tuple(sorted(fk['referred_columns'])))
                 for fk in inspector.get_foreign_keys(table_name)],
                key=lambda x: (x[0], x[1], x[2])
            )
            
            # Get indexes and sort them
            indexes = sorted(
                [(idx['name'], tuple(sorted(idx['column_names'])), idx.get('unique', False))
                 for idx in inspector.get_indexes(table_name)],
                key=lambda x: (x[0] or '', x[1], x[2])
            )
            
            # Create a tuple of sorted components
            table_def = (
                table_name,
                tuple(col_info),
                tuple(foreign_keys),
                tuple(indexes)
            )
            schema_def.append(table_def)
        
        # Create deterministic string representation
        schema_str = repr(sorted(schema_def))
        return hashlib.sha256(schema_str.encode()).hexdigest()

    def schema_requires_migration(self, target_hash: str) -> bool:
        """Check if current schema matches target hash"""
        current_hash = self.get_schema_hash()
        return current_hash != target_hash
