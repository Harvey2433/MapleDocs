"""ONLYOFFICE configuration, access token and save callback helpers."""

import datetime as dt
from urllib.parse import urlparse, urlunparse

from django.conf import settings

import jwt
import requests


class OnlyOfficeError(Exception):
    """Base exception for ONLYOFFICE integration failures."""


def create_access_token(document_id, purpose):
    """Create a short-lived token for file fetches and save callbacks."""

    return jwt.encode(
        {
            "document_id": str(document_id),
            "purpose": purpose,
            "iat": dt.datetime.now(tz=dt.UTC),
            "exp": dt.datetime.now(tz=dt.UTC)
            + dt.timedelta(seconds=settings.ONLYOFFICE_TOKEN_TTL_SECONDS),
        },
        str(settings.ONLYOFFICE_JWT_SECRET),
        algorithm="HS256",
    )


def verify_access_token(token, document_id, purpose):
    """Verify a purpose-bound document token."""

    try:
        payload = jwt.decode(
            token,
            str(settings.ONLYOFFICE_JWT_SECRET),
            algorithms=["HS256"],
        )
    except jwt.PyJWTError as err:
        raise OnlyOfficeError("Invalid ONLYOFFICE access token.") from err
    if payload.get("document_id") != str(document_id) or payload.get("purpose") != purpose:
        raise OnlyOfficeError("ONLYOFFICE token scope does not match the request.")


def sign_editor_config(config):
    """Sign the editor configuration for Document Server."""

    return jwt.encode(
        config,
        str(settings.ONLYOFFICE_JWT_SECRET),
        algorithm="HS256",
    )


def download_callback_file(url):
    """Download a saved office file only from the configured Document Server."""

    public_server = urlparse(settings.ONLYOFFICE_DOCUMENT_SERVER_URL)
    internal_server = urlparse(settings.ONLYOFFICE_DOCUMENT_SERVER_INTERNAL_URL)
    target = urlparse(url)
    trusted_hosts = {public_server.netloc, internal_server.netloc}
    if target.scheme not in {"http", "https"} or target.netloc not in trusted_hosts:
        raise OnlyOfficeError("Refusing an untrusted ONLYOFFICE callback URL.")

    internal_target = target._replace(
        scheme=internal_server.scheme,
        netloc=internal_server.netloc,
    )
    download_url = urlunparse(internal_target)

    try:
        response = requests.get(
            download_url,
            timeout=settings.ONLYOFFICE_REQUEST_TIMEOUT,
            stream=True,
            allow_redirects=False,
        )
        if not 200 <= response.status_code < 300:
            raise OnlyOfficeError("Document Server returned an invalid save response.")
    except requests.RequestException as err:
        raise OnlyOfficeError("Failed to download the saved office document.") from err

    content = bytearray()
    for chunk in response.iter_content(chunk_size=1024 * 1024):
        content.extend(chunk)
        if len(content) > settings.ONLYOFFICE_FILE_MAX_SIZE:
            raise OnlyOfficeError("Saved office document exceeds the size limit.")
    return bytes(content)
