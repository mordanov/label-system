import os
import sys
from unittest.mock import MagicMock

# asyncpg is only available inside Docker; stub it for local unit tests
_asyncpg_stub = MagicMock()
sys.modules.setdefault("asyncpg", _asyncpg_stub)
sys.modules.setdefault("asyncpg.pgproto", _asyncpg_stub)
sys.modules.setdefault("asyncpg.pgproto.pgproto", _asyncpg_stub)

def pytest_configure(config):
    os.environ.setdefault("DB_HOST", "localhost")
    os.environ.setdefault("DB_PORT", "5432")
    os.environ.setdefault("DB_USER", "test")
    os.environ.setdefault("DB_PASSWORD", "test")
    os.environ.setdefault("DB_NAME", "test")
    os.environ.setdefault("APP_USER_1", "admin")
    os.environ.setdefault("APP_PASS_1", "testpass123")
    os.environ.setdefault("APP_USER_2", "user2")
    os.environ.setdefault("APP_PASS_2", "testpass456")
