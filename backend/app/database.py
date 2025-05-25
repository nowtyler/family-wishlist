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
    inspector = inspect(engine)
    
    # Create all tables that don't exist
    Base.metadata.create_all(bind=engine)
    
    # Add missing columns to existing tables
    with engine.connect() as conn:
        if 'wishlist_items' in inspector.get_table_names():
            existing_columns = [col['name'] for col in inspector.get_columns('wishlist_items')]
            if 'purchased_by' not in existing_columns:
                print("Adding purchased_by column to wishlist_items table...")
                conn.execute(text('ALTER TABLE wishlist_items ADD COLUMN purchased_by VARCHAR'))
                conn.commit()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()