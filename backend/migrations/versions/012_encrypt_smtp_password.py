"""Encrypt plaintext smtp_password in email_settings

Revision ID: 012_encrypt_smtp_password
Revises: ede8ea1b8973
Create Date: 2026-10-11

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import text, inspect
import logging

logger = logging.getLogger(__name__)

# revision identifiers, used by Alembic.
revision = '012_encrypt_smtp_password'
down_revision = 'ede8ea1b8973'
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)
    tables = inspector.get_table_names()
    if 'email_settings' not in tables:
        return

    columns = [col['name'] for col in inspector.get_columns('email_settings')]
    if 'smtp_password' not in columns:
        return

    rows = bind.execute(text(
        "SELECT id, smtp_password FROM email_settings WHERE smtp_password IS NOT NULL AND smtp_password != ''"
    )).fetchall()

    if not rows:
        return

    try:
        from app.utils.passphrase_utils import encrypt_secret, decrypt_secret
    except ImportError:
        try:
            from backend.app.utils.passphrase_utils import encrypt_secret, decrypt_secret
        except ImportError:
            logger.warning("Could not import encrypt_secret in migration; skipping auto-encryption")
            return

    for row_id, raw_pw in rows:
        try:
            decrypted = decrypt_secret(raw_pw)
            if decrypted == raw_pw and not raw_pw.startswith("gAAAAA"):
                encrypted = encrypt_secret(raw_pw)
                bind.execute(
                    text("UPDATE email_settings SET smtp_password = :enc WHERE id = :id"),
                    {"enc": encrypted, "id": row_id}
                )
                logger.info(f"Encrypted legacy smtp_password for email_settings row {row_id}")
        except Exception as e:
            logger.warning(f"Could not encrypt smtp_password for row {row_id}: {e}")


def downgrade() -> None:
    # Downgrade decrypts stored passwords back to plaintext if desired
    bind = op.get_bind()
    inspector = inspect(bind)
    tables = inspector.get_table_names()
    if 'email_settings' not in tables:
        return

    columns = [col['name'] for col in inspector.get_columns('email_settings')]
    if 'smtp_password' not in columns:
        return

    rows = bind.execute(text(
        "SELECT id, smtp_password FROM email_settings WHERE smtp_password IS NOT NULL AND smtp_password != ''"
    )).fetchall()

    try:
        from app.utils.passphrase_utils import decrypt_secret
    except ImportError:
        try:
            from backend.app.utils.passphrase_utils import decrypt_secret
        except ImportError:
            return

    for row_id, raw_pw in rows:
        try:
            decrypted = decrypt_secret(raw_pw)
            bind.execute(
                text("UPDATE email_settings SET smtp_password = :dec WHERE id = :id"),
                {"dec": decrypted, "id": row_id}
            )
        except Exception:
            pass
