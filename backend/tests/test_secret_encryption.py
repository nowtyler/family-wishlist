#!/usr/bin/env python3
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.utils.passphrase_utils import encrypt_secret, decrypt_secret
from app.models import EmailSettings


def test_encrypt_and_decrypt_secret():
    secret = "SuperSecretPassword123!"
    encrypted = encrypt_secret(secret)

    # Must be encrypted (not plaintext)
    assert encrypted != secret
    assert encrypted.startswith("gAAAAA")

    # Decrypt must match original
    decrypted = decrypt_secret(encrypted)
    assert decrypted == secret


def test_encrypt_secret_idempotent():
    secret = "MySmtpPassword"
    encrypted_once = encrypt_secret(secret)
    encrypted_twice = encrypt_secret(encrypted_once)

    # Calling encrypt again on ciphertext shouldn't double-encrypt
    assert encrypted_once == encrypted_twice
    assert decrypt_secret(encrypted_twice) == secret


def test_decrypt_secret_legacy_plaintext_fallback():
    # If legacy database has unencrypted password, it should safely return plaintext
    plaintext = "old_unencrypted_password"
    assert decrypt_secret(plaintext) == plaintext


def test_empty_secrets():
    assert encrypt_secret("") == ""
    assert decrypt_secret("") == ""
    assert decrypt_secret(None) == ""


def test_email_settings_model_transparent_encryption():
    settings = EmailSettings(
        smtp_server="smtp.example.com",
        smtp_port=587,
        smtp_username="user@example.com",
        smtp_password="MySecretPassword!",
        from_email="user@example.com",
        from_name="Wishlist",
    )

    # Stored column must be encrypted
    assert settings._smtp_password != "MySecretPassword!"
    assert settings._smtp_password.startswith("gAAAAA")

    # Property getter must return plaintext
    assert settings.smtp_password == "MySecretPassword!"

    # Updating password re-encrypts
    settings.smtp_password = "NewPassword456"
    assert settings._smtp_password != "NewPassword456"
    assert settings._smtp_password.startswith("gAAAAA")
    assert settings.smtp_password == "NewPassword456"
