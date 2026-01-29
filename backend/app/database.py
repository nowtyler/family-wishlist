# backend/app/database.py
import os
from sqlalchemy import create_engine, inspect, text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
import logging

# Set up logging
# logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Get environment from env var (defaults to 'prod')
ENVIRONMENT = os.getenv("ENVIRONMENT", "prod").lower()

# Use the specific database URL from environment variable
SQLALCHEMY_DATABASE_URL = os.getenv("WISHLIST_DATABASE_URL", "sqlite:///./data/wishlist.db")
logger.info(f"Using database URL: {SQLALCHEMY_DATABASE_URL} (Environment: {ENVIRONMENT})")

# Create the engine with SQLite-specific parameters
engine = create_engine(
    SQLALCHEMY_DATABASE_URL, 
    connect_args={"check_same_thread": False} if SQLALCHEMY_DATABASE_URL.startswith("sqlite") else {}
)

# Create a SessionLocal class
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Create a Base class
Base = declarative_base()

def _apply_pending_migrations():
    """Apply pending schema migrations"""
    try:
        with engine.connect() as conn:
            # Check if first_login column exists
            result = conn.execute(text("PRAGMA table_info(family_members)"))
            columns = [row[1] for row in result.fetchall()]

            if 'first_login' not in columns:
                logger.info("Applying migration: Adding first_login column to family_members")
                # Add the column with default value TRUE for new users
                conn.execute(text(
                    "ALTER TABLE family_members ADD COLUMN first_login BOOLEAN DEFAULT 1"
                ))

                # Set existing users to first_login=FALSE
                # (they've already logged in before this feature was added)
                conn.execute(text(
                    "UPDATE family_members SET first_login = 0"
                ))

                conn.commit()
                logger.info("✓ Migration complete: first_login column added")

                # Update schema hash after migration to prevent auto-migration detection
                try:
                    _update_schema_hash_after_migration(conn)
                except Exception as hash_error:
                    logger.warning(f"Could not update schema hash after migration: {hash_error}")
            else:
                logger.debug("Migration skipped: first_login column already exists")

            # Migration 002: Clear plaintext reset tokens (now stored as SHA-256 hashes)
            # Check if any unhashed tokens exist (plaintext tokens are 64 chars, SHA-256 hashes are 64 hex chars)
            # We detect plaintext tokens by checking if any token is NOT a valid hex string
            result = conn.execute(text(
                "SELECT COUNT(*) FROM family_members WHERE reset_token IS NOT NULL"
            ))
            tokens_exist = result.scalar() > 0

            if tokens_exist:
                # Check if tokens look like plaintext (contain non-hex characters)
                result = conn.execute(text(
                    "SELECT reset_token FROM family_members WHERE reset_token IS NOT NULL LIMIT 1"
                ))
                sample_token = result.scalar()

                # SHA-256 hashes are 64 hex characters. Plaintext tokens contain alphanumeric chars
                # that may include uppercase letters not valid in hex (G-Z)
                is_plaintext = sample_token and not all(c in '0123456789abcdef' for c in sample_token.lower())

                if is_plaintext:
                    logger.info("Applying migration: Clearing plaintext reset tokens (now stored as hashes)")
                    conn.execute(text(
                        "UPDATE family_members SET reset_token = NULL, reset_token_expires = NULL WHERE reset_token IS NOT NULL"
                    ))
                    conn.commit()
                    logger.info("✓ Migration complete: Plaintext reset tokens cleared")
    except Exception as e:
        logger.error(f"Migration error: {e}")
        # Don't fail startup if migration fails
        pass

def _update_schema_hash_after_migration(conn):
    """Update the stored schema hash after applying a manual migration"""
    import hashlib
    from sqlalchemy.schema import CreateTable

    # Generate current schema hash from models
    schema_def = []
    for table in Base.metadata.sorted_tables:
        create_stmt = str(CreateTable(table).compile(engine))
        schema_def.append(create_stmt)

    schema_str = '\n'.join(sorted(schema_def))
    current_hash = hashlib.sha256(schema_str.encode()).hexdigest()

    # Update system_settings table with new hash
    conn.execute(text(
        "UPDATE system_settings SET schema_hash = :hash WHERE id = 1"
    ), {"hash": current_hash})
    conn.commit()
    logger.info(f"Updated schema hash after migration: {current_hash[:16]}...")

def create_db_and_tables():
    """Initialize database"""
    is_fresh_install = False
    db_file = SQLALCHEMY_DATABASE_URL.replace('sqlite:///', '')

    # Check if this is a fresh installation
    if not os.path.exists(db_file):
        is_fresh_install = True
        # Ensure directory exists
        os.makedirs(os.path.dirname(db_file), exist_ok=True)

        # Create the database file, ensuring it's owned by root for security
        # The database will be created by SQLAlchemy
        logger.info(f"Fresh installation detected, creating database file: {db_file}")

    # Create tables if they don't exist
    inspector = inspect(engine)
    existing_tables = inspector.get_table_names()

    if not existing_tables:
        # This is a fresh install - create all tables
        Base.metadata.create_all(bind=engine)
        logger.info("Created fresh database and tables")
        is_fresh_install = True

        # Set secure permissions for the database file - this should be root owned
        try:
            # The SQLite database should remain readable/writable by the app but stay owned by root
            # This is already handled by the entrypoint script
            pass
        except Exception as e:
            logger.warning(f"Could not set database file permissions: {str(e)}")
    else:
        logger.info("Database tables already exist, skipping creation")

        # Apply migrations for existing databases
        _apply_pending_migrations()

    # If this is a fresh install, set up system settings
    if is_fresh_install:
        # Create a session to use for initialization
        SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
        db = SessionLocal()
        try:
            # Create default email templates
            from .services.email_service import create_default_templates
            create_default_templates(db)
            logger.info("Created default email templates")
            db.commit()
        except Exception as e:
            logger.error(f"Error creating default templates: {e}")
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