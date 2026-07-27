"""Unit tests for ONLYOFFICE token and callback helpers."""

from unittest.mock import MagicMock, patch
from uuid import uuid4

import pytest

from core.services.onlyoffice import (
    OnlyOfficeError,
    create_access_token,
    download_callback_file,
    verify_access_token,
)


def test_onlyoffice_access_token_is_document_and_purpose_bound(settings):
    settings.ONLYOFFICE_JWT_SECRET = "test-onlyoffice-secret-at-least-32-bytes"
    settings.ONLYOFFICE_TOKEN_TTL_SECONDS = 60
    document_id = uuid4()

    token = create_access_token(document_id, "file")

    verify_access_token(token, document_id, "file")
    with pytest.raises(OnlyOfficeError, match="scope does not match"):
        verify_access_token(token, document_id, "callback")
    with pytest.raises(OnlyOfficeError, match="scope does not match"):
        verify_access_token(token, uuid4(), "file")


def test_onlyoffice_access_token_rejects_invalid_signature(settings):
    settings.ONLYOFFICE_JWT_SECRET = "test-onlyoffice-secret-at-least-32-bytes"

    with pytest.raises(OnlyOfficeError, match="Invalid ONLYOFFICE access token"):
        verify_access_token("not-a-token", uuid4(), "file")


def test_callback_download_rewrites_public_url_to_internal_server(settings):
    settings.ONLYOFFICE_DOCUMENT_SERVER_URL = "https://office.example/onlyoffice"
    settings.ONLYOFFICE_DOCUMENT_SERVER_INTERNAL_URL = "http://onlyoffice"
    settings.ONLYOFFICE_REQUEST_TIMEOUT = 12
    settings.ONLYOFFICE_FILE_MAX_SIZE = 1024
    response = MagicMock(status_code=200)
    response.iter_content.return_value = iter([b"latest ", b"document"])

    with patch("core.services.onlyoffice.requests.get", return_value=response) as get:
        content = download_callback_file(
            "https://office.example/onlyoffice/cache/files/latest.docx?token=save"
        )

    assert content == b"latest document"
    get.assert_called_once_with(
        "http://onlyoffice/onlyoffice/cache/files/latest.docx?token=save",
        timeout=12,
        stream=True,
        allow_redirects=False,
    )


def test_callback_download_rejects_untrusted_host(settings):
    settings.ONLYOFFICE_DOCUMENT_SERVER_URL = "https://office.example/onlyoffice"
    settings.ONLYOFFICE_DOCUMENT_SERVER_INTERNAL_URL = "http://onlyoffice"

    with (
        patch("core.services.onlyoffice.requests.get") as get,
        pytest.raises(OnlyOfficeError, match="untrusted"),
    ):
        download_callback_file("https://attacker.example/latest.docx")

    get.assert_not_called()


def test_callback_download_rejects_redirects(settings):
    settings.ONLYOFFICE_DOCUMENT_SERVER_URL = "https://office.example/onlyoffice"
    settings.ONLYOFFICE_DOCUMENT_SERVER_INTERNAL_URL = "http://onlyoffice"
    response = MagicMock(status_code=302)

    with (
        patch("core.services.onlyoffice.requests.get", return_value=response),
        pytest.raises(OnlyOfficeError, match="invalid save response"),
    ):
        download_callback_file("https://office.example/onlyoffice/cache/latest.docx")


def test_callback_download_enforces_saved_file_limit(settings):
    settings.ONLYOFFICE_DOCUMENT_SERVER_URL = "https://office.example/onlyoffice"
    settings.ONLYOFFICE_DOCUMENT_SERVER_INTERNAL_URL = "http://onlyoffice"
    settings.ONLYOFFICE_FILE_MAX_SIZE = 4
    response = MagicMock(status_code=200)
    response.iter_content.return_value = iter([b"123", b"45"])

    with (
        patch("core.services.onlyoffice.requests.get", return_value=response),
        pytest.raises(OnlyOfficeError, match="exceeds the size limit"),
    ):
        download_callback_file("https://office.example/onlyoffice/cache/latest.docx")
