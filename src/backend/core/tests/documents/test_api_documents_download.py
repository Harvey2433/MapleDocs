"""Tests for same-format document downloads."""

from io import BytesIO
from unittest.mock import PropertyMock, patch

import pytest
from rest_framework.test import APIClient

from core import factories
from core.models import Document, DocumentAccess
from core.services import mime_types

pytestmark = pytest.mark.django_db


def create_owned_document(user, **kwargs):
    """Create a root document without touching collaborative object storage."""

    document = Document.add_root(creator=user, **kwargs)
    DocumentAccess.objects.create(document=document, user=user, role="owner")
    return document


def test_markdown_download_uses_latest_collaborative_content():
    """Markdown is regenerated from the last saved Yjs version and remains Markdown."""

    user = factories.UserFactory()
    document = create_owned_document(
        user,
        title="Release notes",
        file_type="markdown",
        source_name="release-notes.md",
        source_mime_type=mime_types.MARKDOWN,
        source_revision=4,
    )
    client = APIClient()
    client.force_login(user)

    with (
        patch.object(
            Document, "content", new_callable=PropertyMock, return_value="latest-yjs"
        ),
        patch("core.api.viewsets.Converter.convert", return_value="# Latest\n")
        as mock_convert,
        patch.object(Document, "save_source_file") as mock_save_source,
        patch.object(
            Document,
            "get_source_response",
            return_value={
                "Body": BytesIO(b"# Latest\n"),
                "ContentLength": 9,
            },
        ),
    ):
        response = client.get(f"/api/v1.0/documents/{document.id}/download/")
        body = b"".join(response.streaming_content)

    assert response.status_code == 200
    assert body == b"# Latest\n"
    assert 'filename="release-notes.md"' in response["Content-Disposition"]
    mock_convert.assert_called_once_with(
        "latest-yjs", content_type=mime_types.YJS, accept=mime_types.MARKDOWN
    )
    mock_save_source.assert_called_once_with(
        b"# Latest\n", "release-notes.md", mime_types.MARKDOWN, "markdown"
    )


@pytest.mark.parametrize(
    ("file_type", "filename", "mime_type"),
    [
        ("doc", "contract.doc", mime_types.DOC),
        ("docx", "contract.docx", mime_types.DOCX),
    ],
)
def test_office_download_streams_last_saved_source(file_type, filename, mime_type):
    """Office files are streamed byte-for-byte in their imported format."""

    user = factories.UserFactory()
    document = create_owned_document(
        user,
        title="Contract",
        file_type=file_type,
        source_name=filename,
        source_mime_type=mime_type,
        source_size=18,
        source_revision=7,
    )
    client = APIClient()
    client.force_login(user)
    latest_source = b"latest office data"

    with (
        patch("core.api.viewsets.Converter.convert") as mock_convert,
        patch.object(
            Document,
            "get_source_response",
            return_value={
                "Body": BytesIO(latest_source),
                "ContentLength": len(latest_source),
            },
        ),
    ):
        response = client.get(f"/api/v1.0/documents/{document.id}/download/")
        body = b"".join(response.streaming_content)

    assert response.status_code == 200
    assert body == latest_source
    assert response["Content-Type"] == mime_type
    assert f'filename="{filename}"' in response["Content-Disposition"]
    assert response["X-Document-Revision"] == "7"
    mock_convert.assert_not_called()


def test_download_rejects_anonymous_access_to_restricted_document():
    """A source download follows the same access policy as its document."""

    owner = factories.UserFactory()
    document = create_owned_document(
        owner,
        title="Private",
        file_type="docx",
        source_name="private.docx",
        link_reach="restricted",
    )

    response = APIClient().get(f"/api/v1.0/documents/{document.id}/download/")

    assert response.status_code in {401, 403}
