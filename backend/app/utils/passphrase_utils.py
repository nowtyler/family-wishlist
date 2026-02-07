import os
import secrets
import hmac
import logging
from cryptography.fernet import Fernet

logger = logging.getLogger(__name__)

# Key file path — stored separately from the database
_KEY_FILE_PATHS = [
    '/app/data/.recovery_key',
    './data/.recovery_key',
]

# Curated word list for passphrase generation (~200 common, easy-to-spell nouns)
WORD_LIST = [
    "anchor", "apple", "arrow", "badge", "basket", "beacon", "blanket", "bloom",
    "bolt", "bottle", "branch", "breeze", "bridge", "bucket", "cabin", "candle",
    "canyon", "castle", "cedar", "chain", "cherry", "cliff", "clock", "cloud",
    "cobalt", "compass", "copper", "coral", "cotton", "crane", "creek", "crown",
    "crystal", "daisy", "dawn", "delta", "desert", "diamond", "dolphin", "dragon",
    "drift", "eagle", "echo", "ember", "falcon", "feather", "fern", "fiddle",
    "flame", "flint", "forest", "fossil", "frost", "garden", "garnet", "glacier",
    "globe", "granite", "grove", "harbor", "harvest", "hawk", "hazel", "heron",
    "hollow", "honey", "horizon", "ivory", "jade", "jasmine", "jungle", "kestrel",
    "lantern", "lark", "laurel", "lemon", "lily", "linden", "lodge", "lotus",
    "lumber", "maple", "marble", "meadow", "mirror", "mist", "moon", "mosaic",
    "moss", "nectar", "north", "nutmeg", "oak", "oasis", "ocean", "olive",
    "onyx", "orchid", "otter", "owl", "palm", "panther", "parrot", "pearl",
    "pebble", "pelican", "pepper", "phoenix", "pilot", "pine", "plum", "pond",
    "poplar", "prism", "quartz", "rabbit", "raven", "reef", "ridge", "ripple",
    "river", "robin", "rocket", "rose", "ruby", "sage", "salmon", "sandal",
    "sapphire", "scarlet", "shadow", "shore", "silver", "slate", "snow", "solar",
    "sparrow", "spruce", "star", "stone", "storm", "stream", "summit", "sunset",
    "swan", "thistle", "thunder", "tiger", "timber", "topaz", "torch", "tower",
    "trail", "tulip", "turtle", "valley", "velvet", "violet", "walnut", "wave",
    "wheat", "willow", "wind", "winter", "wolf", "yarrow", "zenith", "zinnia",
    "amber", "aspen", "atlas", "birch", "blaze", "brook", "cactus", "charm",
    "cider", "clover", "comet", "cove", "dahlia", "dune", "elm", "ember",
    "fig", "ginger", "glen", "haze", "iris", "ivy", "juniper", "kite",
    "lavender", "linen", "lynx", "mango", "marsh", "mint", "opal", "orca",
    "peach", "penny", "pixel", "plume", "quill", "rafter", "rain", "sable",
]


def _get_key_file_path():
    """Find a writable path for the encryption key file."""
    for path in _KEY_FILE_PATHS:
        key_dir = os.path.dirname(path)
        if os.path.exists(key_dir):
            return path
    # Fallback to first path and try to create dir
    path = _KEY_FILE_PATHS[0]
    os.makedirs(os.path.dirname(path), exist_ok=True)
    return path


def _get_or_create_key():
    """Load or generate the Fernet encryption key from a file."""
    key_path = _get_key_file_path()

    if os.path.exists(key_path):
        with open(key_path, 'rb') as f:
            key = f.read().strip()
            if key:
                return key

    # Generate a new key
    key = Fernet.generate_key()
    with open(key_path, 'wb') as f:
        f.write(key)

    # Restrict permissions to owner only
    try:
        os.chmod(key_path, 0o600)
    except OSError:
        logger.warning(f"Could not set restrictive permissions on {key_path}")

    logger.info("Generated new recovery passphrase encryption key")
    return key


def _get_fernet():
    """Get a Fernet instance with the encryption key."""
    return Fernet(_get_or_create_key())


def generate_passphrase(word_count=6):
    """Generate a random passphrase from the word list."""
    words = [secrets.choice(WORD_LIST) for _ in range(word_count)]
    return ' '.join(words)


def encrypt_passphrase(plaintext):
    """Encrypt a passphrase for secure database storage."""
    f = _get_fernet()
    return f.encrypt(plaintext.encode('utf-8')).decode('utf-8')


def decrypt_passphrase(encrypted):
    """Decrypt a stored passphrase."""
    f = _get_fernet()
    return f.decrypt(encrypted.encode('utf-8')).decode('utf-8')


def verify_passphrase(input_passphrase, encrypted_passphrase):
    """Verify an input passphrase against the encrypted stored value."""
    try:
        stored = decrypt_passphrase(encrypted_passphrase)
        # Constant-time comparison to prevent timing attacks
        return hmac.compare_digest(
            input_passphrase.lower().strip(),
            stored.lower().strip()
        )
    except Exception as e:
        logger.error(f"Passphrase verification error: {e}")
        return False
