"""Tests for optional local session authentication."""

import pytest
from rest_framework.test import APIClient

from core import factories
from core.models import User

pytestmark = pytest.mark.django_db

PASSWORD = "Correct-Horse-Battery-Staple-42"


def test_local_registration_creates_account_and_session(settings):
    settings.LOCAL_AUTH_ENABLED = True
    settings.LOCAL_AUTH_REGISTRATION_ENABLED = True
    client = APIClient()

    response = client.post(
        "/api/v1.0/auth/local/register/",
        {
            "email": "New.User@Example.com",
            "full_name": "New User",
            "password": PASSWORD,
        },
        format="json",
    )

    assert response.status_code == 201
    user = User.objects.get(admin_email="new.user@example.com")
    assert user.email == "new.user@example.com"
    assert user.full_name == "New User"
    assert user.check_password(PASSWORD)
    assert client.get("/api/v1.0/users/me/").status_code == 200


def test_local_registration_rejects_case_insensitive_duplicate(settings):
    settings.LOCAL_AUTH_ENABLED = True
    settings.LOCAL_AUTH_REGISTRATION_ENABLED = True
    existing = factories.UserFactory(
        admin_email="member@example.com", email="member@example.com"
    )
    existing.set_password(PASSWORD)
    existing.save()

    response = APIClient().post(
        "/api/v1.0/auth/local/register/",
        {
            "email": "MEMBER@example.com",
            "full_name": "Duplicate",
            "password": PASSWORD,
        },
        format="json",
    )

    assert response.status_code == 400
    assert User.objects.filter(admin_email__iexact="member@example.com").count() == 1


def test_local_login_accepts_email_and_creates_session(settings):
    settings.LOCAL_AUTH_ENABLED = True
    user = factories.UserFactory(
        admin_email="member@example.com", email="member@example.com"
    )
    user.set_password(PASSWORD)
    user.save()
    client = APIClient()

    response = client.post(
        "/api/v1.0/auth/local/login/",
        {"email": "member@example.com", "password": PASSWORD},
        format="json",
    )

    assert response.status_code == 200
    assert response.json()["id"] == str(user.id)
    assert client.get("/api/v1.0/users/me/").status_code == 200


def test_local_login_rejects_invalid_password(settings):
    settings.LOCAL_AUTH_ENABLED = True
    user = factories.UserFactory(
        admin_email="member@example.com", email="member@example.com"
    )
    user.set_password(PASSWORD)
    user.save()

    response = APIClient().post(
        "/api/v1.0/auth/local/login/",
        {"email": "member@example.com", "password": "wrong-password"},
        format="json",
    )

    assert response.status_code == 401


def test_local_auth_routes_follow_feature_flags(settings):
    settings.LOCAL_AUTH_ENABLED = False
    client = APIClient()

    assert (
        client.post(
            "/api/v1.0/auth/local/login/",
            {"email": "member@example.com", "password": PASSWORD},
            format="json",
        ).status_code
        == 404
    )
    assert (
        client.post(
            "/api/v1.0/auth/local/register/",
            {
                "email": "member@example.com",
                "full_name": "Member",
                "password": PASSWORD,
            },
            format="json",
        ).status_code
        == 404
    )


def test_local_logout_destroys_authenticated_session(settings):
    settings.LOCAL_AUTH_ENABLED = True
    user = factories.UserFactory()
    client = APIClient()
    client.force_login(user)

    response = client.post("/api/v1.0/auth/local/logout/")

    assert response.status_code == 204
    assert client.get("/api/v1.0/users/me/").status_code in {401, 403}
