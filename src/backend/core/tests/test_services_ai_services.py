"""Tests for the retained legacy AI service."""

from unittest.mock import MagicMock, patch

from django.core.exceptions import ImproperlyConfigured

import pytest
from mistralai import Mistral
from openai import OpenAI, OpenAIError

from core.services.ai_services.legacy import (
    LegacyAiServiceMistralClient,
    LegacyAiServiceOpenAiClient,
    get_legacy_ai_service,
)

pytestmark = pytest.mark.django_db


@pytest.fixture(autouse=True)
def ai_settings(settings):
    """Configure and isolate the legacy client cache."""

    settings.AI_MODEL = "llama"
    settings.OPENAI_SDK_BASE_URL = "http://example.com"
    settings.OPENAI_SDK_API_KEY = "test-key"
    settings.AI_FEATURE_ENABLED = True
    settings.AI_FEATURE_LEGACY_ENABLED = True
    settings.LANGFUSE_PUBLIC_KEY = None
    yield
    get_legacy_ai_service.cache_clear()


@pytest.mark.parametrize(
    "setting_name", ["OPENAI_SDK_BASE_URL", "OPENAI_SDK_API_KEY", "AI_MODEL"]
)
def test_openai_legacy_client_requires_complete_settings(settings, setting_name):
    setattr(settings, setting_name, None)

    with pytest.raises(ImproperlyConfigured, match="AI configuration not set"):
        LegacyAiServiceOpenAiClient()


def test_openai_legacy_client_is_configured():
    assert isinstance(LegacyAiServiceOpenAiClient().client, OpenAI)


@pytest.mark.parametrize(
    "setting_name", ["MISTRAL_SDK_BASE_URL", "MISTRAL_SDK_API_KEY", "AI_MODEL"]
)
def test_mistral_legacy_client_requires_complete_settings(settings, setting_name):
    settings.OPENAI_SDK_BASE_URL = None
    settings.OPENAI_SDK_API_KEY = None
    settings.MISTRAL_SDK_BASE_URL = "https://mistral.example"
    settings.MISTRAL_SDK_API_KEY = "test-key"
    setattr(settings, setting_name, None)

    with pytest.raises(ImproperlyConfigured, match="Mistral sdk configuration not set"):
        LegacyAiServiceMistralClient()


def test_mistral_legacy_client_is_configured(settings):
    settings.OPENAI_SDK_BASE_URL = None
    settings.OPENAI_SDK_API_KEY = None
    settings.MISTRAL_SDK_BASE_URL = "https://mistral.example"
    settings.MISTRAL_SDK_API_KEY = "test-key"

    assert isinstance(LegacyAiServiceMistralClient().client, Mistral)


@patch("openai.resources.chat.completions.Completions.create")
def test_legacy_transform_propagates_client_errors(mock_create):
    mock_create.side_effect = OpenAIError("Mocked client error")

    with pytest.raises(OpenAIError, match="Mocked client error"):
        get_legacy_ai_service().transform("hello", "prompt")


@patch("openai.resources.chat.completions.Completions.create")
def test_legacy_transform_rejects_empty_answers(mock_create):
    mock_create.return_value = MagicMock(
        choices=[MagicMock(message=MagicMock(content=None))]
    )

    with pytest.raises(RuntimeError, match="AI response does not contain an answer"):
        get_legacy_ai_service().transform("hello", "prompt")


@patch("openai.resources.chat.completions.Completions.create")
def test_legacy_transform_returns_answer(mock_create):
    mock_create.return_value = MagicMock(
        choices=[MagicMock(message=MagicMock(content="Salut"))]
    )

    assert get_legacy_ai_service().transform("hello", "prompt") == {
        "answer": "Salut"
    }


@patch("openai.resources.chat.completions.Completions.create")
def test_legacy_translate_uses_requested_language(mock_create):
    mock_create.return_value = MagicMock(
        choices=[MagicMock(message=MagicMock(content="Bonjour"))]
    )

    response = get_legacy_ai_service().translate("<p>Hello</p>", "fr")

    assert response == {"answer": "Bonjour"}
    assert "French" in mock_create.call_args.kwargs["messages"][0]["content"]


@patch("openai.resources.chat.completions.Completions.create")
def test_legacy_translate_preserves_unknown_language_code(mock_create):
    mock_create.return_value = MagicMock(
        choices=[MagicMock(message=MagicMock(content="Translated"))]
    )

    response = get_legacy_ai_service().translate("<p>Hello</p>", "xx-unknown")

    assert response == {"answer": "Translated"}
    assert "xx-unknown" in mock_create.call_args.kwargs["messages"][0]["content"]
