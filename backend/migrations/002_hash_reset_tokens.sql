-- Migration: Hash password reset tokens
-- Revision: 002
-- Date: 2026-01-28

-- This migration clears any existing plaintext reset tokens.
-- Reset tokens are now stored as SHA-256 hashes instead of plaintext
-- for improved security. Any pending reset links will be invalidated.

-- Clear existing plaintext tokens (they're incompatible with hashed storage)
UPDATE family_members
SET reset_token = NULL, reset_token_expires = NULL
WHERE reset_token IS NOT NULL;
