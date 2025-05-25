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
    existing_tables = inspector.get_table_names()
    
    # Only create tables if they don't exist
    if not existing_tables:
        Base.metadata.create_all(bind=engine)
        print("Database tables created")
    else:
        print("Database tables already exist, skipping creation")

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()