from alembic.config import Config
from alembic import command
from alembic.script import ScriptDirectory
from alembic.runtime.migration import MigrationContext
from sqlalchemy import create_engine
import os
from typing import List, Dict
from ..schemas import MigrationInfo
import logging

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
            command.upgrade(self.alembic_cfg, target)
            return f"Successfully upgraded to {target}"
        except Exception as e:
            return f"Failed to upgrade: {str(e)}"

    def downgrade(self, target: str) -> str:
        """Downgrades database to target version"""
        try:
            command.downgrade(self.alembic_cfg, target)
            return f"Successfully downgraded to {target}"
        except Exception as e:
            return f"Failed to downgrade: {str(e)}"
