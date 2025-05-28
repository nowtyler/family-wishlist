# backend/app/database.py
from sqlalchemy import create_engine, inspect, text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from sqlalchemy import Column, String
import os

SQLALCHEMY_DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./data/wishlist.db")

engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def create_db_and_tables():
    """Initialize database and mark as foundation if it's a fresh install"""
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
        print("Created fresh database and tables")
        is_fresh_install = True
    else:
        print("Database tables already exist, skipping creation")

    # If this is a fresh install, mark it as the foundation
    if is_fresh_install:
        db = SessionLocal()
        try:
            # First ensure system_settings table exists with all needed columns
            db.execute(text("""
                CREATE TABLE IF NOT EXISTS system_settings (
                    id INTEGER PRIMARY KEY,
                    version STRING DEFAULT '1.0.0',
                    schema_hash STRING,
                    last_updated DATE,
                    is_foundation BOOLEAN DEFAULT TRUE,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            """))
            db.commit()

            # Check if we need to insert initial record (only if none exists)
            result = db.execute(text("SELECT COUNT(*) FROM system_settings")).scalar()
            if result == 0:
                # Get current schema hash
                from .services.migration_service import MigrationService
                migration_service = MigrationService(SQLALCHEMY_DATABASE_URL)
                initial_hash = migration_service.get_schema_hash()
                
                db.execute(text("""
                    INSERT INTO system_settings 
                    (version, schema_hash, is_foundation, last_updated) 
                    VALUES 
                    (:version, :hash, TRUE, CURRENT_DATE)
                """), {"version": "1.0.0", "hash": initial_hash})
                
                db.commit()
                print(f"Initialized foundation database with hash: {initial_hash[:8]}...")
            
                # Initialize alembic_version table for fresh install
                db.execute(text("DROP TABLE IF EXISTS alembic_version"))
                db.execute(text(
                    "CREATE TABLE alembic_version (version_num VARCHAR(32))"
                ))
                db.execute(text("INSERT INTO alembic_version (version_num) VALUES ('base')"))
                db.commit()
                print("Initialized alembic_version table")
        except Exception as e:
            print(f"Error initializing system settings: {e}")
            db.rollback()
        finally:
            db.close()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()