import pytest
from unittest.mock import patch
from app.auth import verify_user

def test_valid_user_returns_username():
    with patch("app.auth.settings") as mock_settings:
        mock_settings.app_user_1 = "alice"
        mock_settings.app_pass_1 = "secret"
        mock_settings.app_user_2 = "bob"
        mock_settings.app_pass_2 = "other"
        # Re-import to rebuild _USERS with mocked settings
        import importlib, app.auth
        importlib.reload(app.auth)
        from app.auth import verify_user
        assert verify_user("alice", "secret") == "alice"

def test_wrong_password_returns_none():
    from app.auth import verify_user
    assert verify_user("alice", "wrongpass") is None

def test_unknown_user_returns_none():
    from app.auth import verify_user
    assert verify_user("nobody", "anything") is None
