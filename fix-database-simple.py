#!/usr/bin/env python3
"""
Simple Database Fix Script for Family Wishlist
This script fixes the current database schema issues.
"""

import sqlite3
import os
from pathlib import Path

def main():
    print("🔧 Family Wishlist Database Fix Script")
    print("=" * 50)
    
    # Create data directory if it doesn't exist
    data_dir = Path("data")
    data_dir.mkdir(exist_ok=True)
    print(f"✅ Data directory: {data_dir.absolute()}")
    
    db_path = data_dir / "wishlist.db"
    
    # Create database if it doesn't exist
    if not db_path.exists():
        print(f"📁 Creating new database: {db_path}")
        conn = sqlite3.connect(db_path)
        conn.close()
    
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    try:
        # Check existing tables
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
        existing_tables = [row[0] for row in cursor.fetchall()]
        print(f"📋 Existing tables: {existing_tables}")
        
        # Add missing columns to family_members table
        columns_to_add = [
            ("username", "VARCHAR"),
            ("password_hash", "VARCHAR"),
            ("email", "VARCHAR"),
            ("reset_token", "VARCHAR"),
            ("reset_token_expires", "DATETIME"),
            ("password_expires_at", "DATETIME"),
            ("temp_password_hash", "VARCHAR"),
            ("force_password_change", "BOOLEAN DEFAULT 0")
        ]
        
        for column, column_type in columns_to_add:
            try:
                cursor.execute(f"ALTER TABLE family_members ADD COLUMN {column} {column_type}")
                print(f"✅ Added column {column} to family_members")
            except sqlite3.OperationalError as e:
                if "duplicate column name" in str(e):
                    print(f"ℹ️  Column {column} already exists in family_members")
                else:
                    print(f"⚠️  Could not add column {column}: {e}")
        
        # Create admin user if it doesn't exist
        try:
            cursor.execute("""
                INSERT OR IGNORE INTO family_members (id, name, is_admin, username, email)
                VALUES (1, 'Admin', 1, 'admin', 'admin@emergency.local')
            """)
            print("✅ Created admin user")
        except Exception as e:
            print(f"⚠️  Could not create admin user: {e}")
        
        conn.commit()
        print("✅ Database schema updated successfully!")
        print("\nNext steps:")
        print("1. Restart your application")
        print("2. Try logging in with username: 'admin'")
        print("3. If login fails, use the emergency access feature")
        
    except Exception as e:
        print(f"❌ Database fix failed: {e}")
        conn.rollback()
    finally:
        conn.close()

if __name__ == "__main__":
    main() 