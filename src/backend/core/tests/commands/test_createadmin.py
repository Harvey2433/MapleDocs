"""Tests for the local administrator creation command."""

from django.core.management import CommandError, call_command

import pytest

from core.models import User

pytestmark = pytest.mark.django_db

PASSWORD = "Correct-Horse-Battery-Staple-42"


def test_createadmin_creates_login_capable_superuser(monkeypatch):
    monkeypatch.setenv("MAPLEDOCS_ADMIN_EMAIL", "Admin@Example.com")
    monkeypatch.setenv("MAPLEDOCS_ADMIN_PASSWORD", PASSWORD)
    monkeypatch.setenv("MAPLEDOCS_ADMIN_NAME", "Maple Admin")

    call_command("createadmin", interactive=False)

    user = User.objects.get(admin_email="admin@example.com")
    assert user.email == "admin@example.com"
    assert user.full_name == "Maple Admin"
    assert user.short_name == "Maple Admin"
    assert user.is_active
    assert user.is_staff
    assert user.is_superuser
    assert user.check_password(PASSWORD)


def test_createadmin_repairs_blank_superuser(monkeypatch):
    user = User.objects.create(is_staff=True, is_superuser=True)
    user.set_unusable_password()
    user.save()
    monkeypatch.setenv("MAPLEDOCS_ADMIN_EMAIL", "admin@example.com")
    monkeypatch.setenv("MAPLEDOCS_ADMIN_PASSWORD", PASSWORD)

    call_command("createadmin", interactive=False)

    user.refresh_from_db()
    assert user.admin_email == "admin@example.com"
    assert user.email == "admin@example.com"
    assert user.check_password(PASSWORD)
    assert User.objects.count() == 1


def test_createadmin_requires_noninteractive_password(monkeypatch):
    monkeypatch.setenv("MAPLEDOCS_ADMIN_EMAIL", "admin@example.com")
    monkeypatch.delenv("MAPLEDOCS_ADMIN_PASSWORD", raising=False)

    with pytest.raises(CommandError, match="MAPLEDOCS_ADMIN_PASSWORD"):
        call_command("createadmin", interactive=False)
