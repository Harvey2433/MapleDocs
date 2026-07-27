"""
Tests for the Resource Server API for document AI features.

Not testing external API endpoints that are already tested in the /api
because the resource server viewsets inherit from the api viewsets.

"""

from unittest.mock import MagicMock, patch

from django.test import override_settings

import pytest
from rest_framework.test import APIClient

from core import factories, models
from core.services.ai_services.legacy import get_legacy_ai_service

pytestmark = pytest.mark.django_db

# pylint: disable=unused-argument


@pytest.fixture(autouse=True)
def clear_openai_client_config():
    """Clear the configure_legacy_openai_client cache."""
    get_legacy_ai_service.cache_clear()


@pytest.fixture
def ai_settings(settings):
    """Enable the retained legacy AI API for explicit tests."""

    settings.AI_MODEL = "llama"
    settings.OPENAI_SDK_BASE_URL = "http://example.com"
    settings.OPENAI_SDK_API_KEY = "test-key"
    settings.AI_FEATURE_ENABLED = True
    settings.AI_FEATURE_LEGACY_ENABLED = True


def test_external_api_documents_ai_transform_not_allowed(
    user_token, resource_server_backend, user_specific_sub
):
    """
    Connected users SHOULD NOT be allowed to access AI transform endpoints
    from a resource server by default.
    """

    document = factories.DocumentFactory(
        link_reach=models.LinkReachChoices.RESTRICTED,
        creator=user_specific_sub,
    )
    client = APIClient()
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {user_token}")

    response = client.post(
        f"/external_api/v1.0/documents/{document.id!s}/ai-transform/",
        {"text": "hello", "action": "prompt"},
    )

    assert response.status_code == 403
    assert response.json() == {
        "detail": "You do not have permission to perform this action."
    }


def test_external_api_documents_ai_translate_not_allowed(
    user_token, resource_server_backend, user_specific_sub
):
    """
    Connected users SHOULD NOT be allowed to access AI translate endpoints
    from a resource server by default.
    """

    document = factories.DocumentFactory(
        link_reach=models.LinkReachChoices.RESTRICTED,
        creator=user_specific_sub,
    )

    client = APIClient()
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {user_token}")

    response = client.post(
        f"/external_api/v1.0/documents/{document.id!s}/ai-translate/",
        {"text": "hello", "language": "es"},
    )

    assert response.status_code == 403
    assert response.json() == {
        "detail": "You do not have permission to perform this action."
    }


# Overrides


@override_settings(
    EXTERNAL_API={
        "documents": {
            "enabled": True,
            "actions": [
                "list",
                "retrieve",
                "children",
                "ai_transform",
            ],
        },
    }
)
@pytest.mark.usefixtures("ai_settings")
@patch("openai.resources.chat.completions.Completions.create")
def test_external_api_documents_ai_transform_can_be_allowed(
    mock_create, user_token, resource_server_backend, user_specific_sub
):
    """
    Users SHOULD be allowed to transform a document using AI when the
    corresponding action is enabled via EXTERNAL_API settings.
    """
    client = APIClient()
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {user_token}")

    document = factories.DocumentFactory(
        link_reach=models.LinkReachChoices.RESTRICTED, favorited_by=[user_specific_sub]
    )
    factories.UserDocumentAccessFactory(
        document=document, user=user_specific_sub, role=models.RoleChoices.OWNER
    )

    mock_create.return_value = MagicMock(
        choices=[MagicMock(message=MagicMock(content="Salut"))]
    )

    url = f"/external_api/v1.0/documents/{document.id!s}/ai-transform/"
    response = client.post(url, {"text": "Hello", "action": "prompt"})

    assert response.status_code == 200
    assert response.json() == {"answer": "Salut"}
    # pylint: disable=line-too-long
    mock_create.assert_called_once_with(
        model="llama",
        messages=[
            {
                "role": "system",
                "content": (
                    "Answer the prompt using markdown formatting for structure and emphasis. "
                    "Return the content directly without wrapping it in code blocks or markdown delimiters. "
                    "Preserve the language and markdown formatting. "
                    "Do not provide any other information. "
                    "Preserve the language."
                ),
            },
            {"role": "user", "content": "Hello"},
        ],
    )

@override_settings(
    EXTERNAL_API={
        "documents": {
            "enabled": True,
            "actions": [
                "list",
                "retrieve",
                "children",
                "ai_translate",
            ],
        },
    }
)
@pytest.mark.usefixtures("ai_settings")
@patch("openai.resources.chat.completions.Completions.create")
def test_external_api_documents_ai_translate_can_be_allowed(
    mock_create, user_token, resource_server_backend, user_specific_sub
):
    """
    Users SHOULD be allowed to translate a document using AI when the
    corresponding action is enabled via EXTERNAL_API settings.
    """
    client = APIClient()
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {user_token}")

    document = factories.DocumentFactory(
        link_reach=models.LinkReachChoices.RESTRICTED, favorited_by=[user_specific_sub]
    )
    factories.UserDocumentAccessFactory(
        document=document, user=user_specific_sub, role=models.RoleChoices.OWNER
    )

    mock_create.return_value = MagicMock(
        choices=[MagicMock(message=MagicMock(content="Salut"))]
    )

    url = f"/external_api/v1.0/documents/{document.id!s}/ai-translate/"
    response = client.post(url, {"text": "Hello", "language": "es-co"})

    assert response.status_code == 200
    assert response.json() == {"answer": "Salut"}
    mock_create.assert_called_once_with(
        model="llama",
        messages=[
            {
                "role": "system",
                "content": (
                    "Keep the same html structure and formatting. "
                    "Translate the content in the html to the "
                    "specified language Colombian Spanish. "
                    "Check the translation for accuracy and make any necessary corrections. "
                    "Do not provide any other information. "
                    "Return the content directly without wrapping it in code blocks or markdown "
                    "delimiters."
                ),
            },
            {"role": "user", "content": "Hello"},
        ],
    )
