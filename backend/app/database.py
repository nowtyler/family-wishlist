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
    Base.metadata.drop_all(bind=engine)  # Temporarily drop all tables
    Base.metadata.create_all(bind=engine)
    print("Database tables created/updated")

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()