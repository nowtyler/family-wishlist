# backend/app/database.py
import os
from sqlalchemy import create_engine, inspect, text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
import logging

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Get environment from env var (defaults to 'prod')
ENVIRONMENT = os.getenv("ENVIRONMENT", "prod").lower()

# Use a single database URL from environment variable
SQLALCHEMY_DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./data/wishlist.db")

# Create the engine with SQLite-specific parameters
engine = create_engine(
    SQLALCHEMY_DATABASE_URL, 
    connect_args={"check_same_thread": False} if SQLALCHEMY_DATABASE_URL.startswith("sqlite") else {}
)

# Create a SessionLocal class
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Create a Base class
Base = declarative_base()

def create_db_and_tables():
    """Initialize database"""
    is_fresh_install = False
    db_file = SQLALCHEMY_DATABASE_URL.replace('sqlite:///', '')
    
    # Check if this is a fresh installation
    if not os.path.exists(db_file):
        is_fresh_install = True
        # Ensure directory exists
        os.makedirs(os.path.dirname(db_file), exist_ok=True)
    
    # Create tables if they don't exist
    inspector = inspect(engine)
    existing_tables = inspector.get_table_names()
    
    if not existing_tables:
        # This is a fresh install - create all tables
        Base.metadata.create_all(bind=engine)
        logger.info("Created fresh database and tables")
        is_fresh_install = True
    else:
        logger.info("Database tables already exist, skipping creation")

    # If this is a fresh install, set up system settings
    if is_fresh_install:
        db = SessionLocal()
        try:
            # Check if we need to insert initial system_settings record
            result = db.execute(text("SELECT COUNT(*) FROM system_settings")).scalar()
            if result == 0:
                # Get current schema hash
                from .services.migration_service import MigrationService
                migration_service = MigrationService(SQLALCHEMY_DATABASE_URL)
                initial_hash = migration_service.get_schema_hash()
                
                db.execute(text("""
                    INSERT INTO system_settings 
                    (version, schema_hash, last_updated) 
                    VALUES 
                    (:version, :hash, CURRENT_DATE)
                """), {"version": "1.0.0", "hash": initial_hash})
                
                db.commit()
                logger.info(f"Initialized system settings with hash: {initial_hash[:8]}...")
            
                # Initialize alembic_version table for fresh install
                db.execute(text("DROP TABLE IF EXISTS alembic_version"))
                db.execute(text(
                    "CREATE TABLE alembic_version (version_num VARCHAR(32))"
                ))
                db.execute(text("INSERT INTO alembic_version (version_num) VALUES ('base')"))
                db.commit()
                logger.info("Initialized alembic_version table")
        except Exception as e:
            logger.error(f"Error initializing system settings: {e}")
            db.rollback()
        finally:
            db.close()

# Dependency to get a database session
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()