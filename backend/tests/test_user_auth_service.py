#!/usr/bin/env python3
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.services.user_auth_service import UserAuthService


BASE_URL_ENV_VARS = [
    "WISHLIST_BASE_URL",
    "BASE_URL",
    "DOMAIN_NAME",
    "ENVIRONMENT",
    "WISHLIST_ALLOWED_ORIGINS",
]


def clear_base_url_env(monkeypatch):
    for env_var in BASE_URL_ENV_VARS:
        monkeypatch.delenv(env_var, raising=False)


def test_get_app_base_url_prefers_configured_url_over_request_origin(monkeypatch):
    clear_base_url_env(monkeypatch)
    monkeypatch.setenv("WISHLIST_BASE_URL", "https://wishlist.example.com/")

    base_url = UserAuthService.get_app_base_url("https://attacker.example")

    assert base_url == "https://wishlist.example.com"


def test_get_app_base_url_prefers_domain_url_over_request_origin(monkeypatch):
    clear_base_url_env(monkeypatch)
    monkeypatch.setenv("DOMAIN_NAME", "example.com")
    monkeypatch.setenv("ENVIRONMENT", "production")

    base_url = UserAuthService.get_app_base_url("https://attacker.example")

    assert base_url == "https://wishlist.example.com"


def test_get_app_base_url_rejects_untrusted_request_origin(monkeypatch):
    clear_base_url_env(monkeypatch)

    base_url = UserAuthService.get_app_base_url("https://attacker.example")

    assert base_url == "http://localhost:5175"


def test_get_app_base_url_accepts_allowlisted_request_origin(monkeypatch):
    clear_base_url_env(monkeypatch)
    monkeypatch.setenv("WISHLIST_ALLOWED_ORIGINS", "https://preview.example.com")

    base_url = UserAuthService.get_app_base_url("https://preview.example.com")

    assert base_url == "https://preview.example.com"
