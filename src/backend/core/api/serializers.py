"""Client serializers for the impress core app."""
# pylint: disable=too-many-lines

import binascii
import mimetypes
import re
from base64 import b64decode
from os.path import splitext

from django.conf import settings
from django.contrib.auth import password_validation
from django.db.models import Q
from django.utils.functional import lazy
from django.utils.text import slugify
from django.utils.translation import gettext_lazy as _

import emoji
import magic
from rest_framework import serializers

from core import choices, enums, models, validators
from core.services import mime_types
from core.services.ai_services.legacy import AI_ACTIONS
from core.services.converter_services import (
    ConversionError,
    Converter,
)
from core.utils.analytics import PosthogEventName, posthog_capture
from core.utils.treebeard import create_tree_node_with_retry


class UserSerializer(serializers.ModelSerializer):
    """Serialize users."""

    full_name = serializers.CharField(required=False, allow_blank=False, max_length=100)
    short_name = serializers.CharField(required=False, allow_blank=False, max_length=100)
    avatar = serializers.ImageField(required=False, write_only=True, allow_null=True)
    background_image = serializers.ImageField(
        required=False, write_only=True, allow_null=True
    )
    avatar_url = serializers.SerializerMethodField(read_only=True)
    background_image_url = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = models.User
        fields = [
            "id",
            "email",
            "full_name",
            "short_name",
            "language",
            "is_first_connection",
            "appearance",
            "avatar",
            "avatar_url",
            "background_image",
            "background_image_url",
        ]
        read_only_fields = [
            "id",
            "email",
            "is_first_connection",
        ]

    def to_representation(self, instance):
        """Return stable display names for legacy users without profile names."""

        data = super().to_representation(instance)
        fallback = slugify((instance.email or instance.admin_email or "user").split("@")[0])
        data["full_name"] = instance.full_name or fallback
        data["short_name"] = instance.short_name or data["full_name"]
        return data

    def get_avatar_url(self, instance):
        """Return an absolute avatar URL when one is configured."""

        if not instance.avatar:
            return None
        request = self.context.get("request")
        return request.build_absolute_uri(instance.avatar.url) if request else instance.avatar.url

    def get_background_image_url(self, instance):
        """Return an absolute background image URL when one is configured."""

        if not instance.background_image:
            return None
        request = self.context.get("request")
        url = instance.background_image.url
        return request.build_absolute_uri(url) if request else url

    def _validate_user_image(self, image):
        if image is None:
            return image
        if image.size > settings.USER_IMAGE_MAX_SIZE:
            raise serializers.ValidationError("Image exceeds the configured size limit.")
        extension = splitext(image.name)[1].lower()
        if extension not in {".jpg", ".jpeg", ".png", ".webp"}:
            raise serializers.ValidationError("Only JPG, PNG and WebP images are allowed.")
        return image

    def validate_avatar(self, image):
        return self._validate_user_image(image)

    def validate_background_image(self, image):
        return self._validate_user_image(image)

    def validate_appearance(self, value):
        """Validate the complete per-user appearance document."""

        if not isinstance(value, dict):
            raise serializers.ValidationError("Appearance must be an object.")
        allowed = {
            "theme_mode",
            "accent",
            "surface_opacity",
            "material",
            "material_strength",
            "background_source",
            "background_url",
            "background_refresh_minutes",
        }
        unknown = set(value) - allowed
        if unknown:
            raise serializers.ValidationError(
                f"Unsupported appearance settings: {', '.join(sorted(unknown))}."
            )
        if value.get("theme_mode", "system") not in {"system", "light", "dark"}:
            raise serializers.ValidationError("Invalid theme mode.")
        if value.get("material", "mica") not in {"mica", "gaussian", "acrylic"}:
            raise serializers.ValidationError("Invalid material.")
        accent = value.get("accent", "#1F5D45")
        if not re.fullmatch(r"#[0-9A-Fa-f]{6}", accent):
            raise serializers.ValidationError("Accent must be a six-digit hex color.")
        for field in ["surface_opacity", "material_strength"]:
            number = value.get(field, 70)
            if not isinstance(number, int) or not 0 <= number <= 100:
                raise serializers.ValidationError(f"{field} must be between 0 and 100.")
        refresh = value.get("background_refresh_minutes", 0)
        if refresh not in {0, 15, 60, 360, 1440}:
            raise serializers.ValidationError("Invalid background refresh interval.")
        background_url = value.get("background_url", "")
        if background_url and not re.match(
            r"^https?://.+\.(?:jpe?g|png|webp)(?:[?#].*)?$", background_url, re.I
        ):
            raise serializers.ValidationError("Background URL must reference JPG, PNG or WebP.")
        return value

    def update(self, instance, validated_data):
        """Replace profile media cleanly and update profile data."""

        for field in ["avatar", "background_image"]:
            if field in validated_data and getattr(instance, field):
                getattr(instance, field).delete(save=False)
        if "full_name" in validated_data and "short_name" not in validated_data:
            validated_data["short_name"] = validated_data["full_name"]
        return super().update(instance, validated_data)


class UserLightSerializer(serializers.ModelSerializer):
    """Serialize users with limited fields."""

    class Meta:
        model = models.User
        fields = ["full_name", "short_name"]
        read_only_fields = ["full_name", "short_name"]


class LocalLoginSerializer(serializers.Serializer):
    """Validate a local account login request."""

    email = serializers.EmailField()
    password = serializers.CharField(trim_whitespace=False, write_only=True)


class LocalRegisterSerializer(serializers.Serializer):
    """Validate local account registration."""

    email = serializers.EmailField()
    full_name = serializers.CharField(max_length=100)
    password = serializers.CharField(trim_whitespace=False, write_only=True)

    def validate_email(self, value):
        if models.User.objects.filter(
            Q(admin_email__iexact=value) | Q(email__iexact=value)
        ).exists():
            raise serializers.ValidationError("An account already uses this email.")
        return value.lower()

    def validate_password(self, value):
        password_validation.validate_password(value)
        return value


class ListDocumentSerializer(serializers.ModelSerializer):
    """Serialize documents with limited fields for display in lists."""

    is_favorite = serializers.BooleanField(read_only=True)
    nb_accesses_ancestors = serializers.IntegerField(read_only=True)
    nb_accesses_direct = serializers.IntegerField(read_only=True)
    user_role = serializers.SerializerMethodField(read_only=True)
    abilities = serializers.SerializerMethodField(read_only=True)
    deleted_at = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = models.Document
        fields = [
            "id",
            "abilities",
            "ancestors_link_reach",
            "ancestors_link_role",
            "computed_link_reach",
            "computed_link_role",
            "created_at",
            "creator",
            "deleted_at",
            "depth",
            "excerpt",
            "is_favorite",
            "file_type",
            "link_role",
            "link_reach",
            "nb_accesses_ancestors",
            "nb_accesses_direct",
            "numchild",
            "path",
            "title",
            "source_name",
            "source_mime_type",
            "source_size",
            "source_sha256",
            "source_revision",
            "updated_at",
            "user_role",
        ]
        read_only_fields = [
            "id",
            "abilities",
            "ancestors_link_reach",
            "ancestors_link_role",
            "computed_link_reach",
            "computed_link_role",
            "created_at",
            "creator",
            "deleted_at",
            "depth",
            "excerpt",
            "is_favorite",
            "file_type",
            "link_role",
            "link_reach",
            "nb_accesses_ancestors",
            "nb_accesses_direct",
            "numchild",
            "path",
            "source_name",
            "source_mime_type",
            "source_size",
            "source_sha256",
            "source_revision",
            "updated_at",
            "user_role",
        ]

    def to_representation(self, instance):
        """Precompute once per instance"""
        paths_links_mapping = self.context.get("paths_links_mapping")

        if paths_links_mapping is not None:
            links = paths_links_mapping.get(instance.path[: -instance.steplen], [])
            instance.ancestors_link_definition = choices.get_equivalent_link_definition(
                links
            )

        return super().to_representation(instance)

    def get_abilities(self, instance) -> dict:
        """Return abilities of the logged-in user on the instance."""
        request = self.context.get("request")
        if not request:
            return {}

        return instance.get_abilities(request.user)

    def get_user_role(self, instance):
        """
        Return roles of the logged-in user for the current document,
        taking into account ancestors.
        """
        request = self.context.get("request")
        return instance.get_role(request.user) if request else None

    def get_deleted_at(self, instance):
        """Return the deleted_at of the current document."""
        return instance.ancestors_deleted_at


class DocumentLightSerializer(serializers.ModelSerializer):
    """Minial document serializer for nesting in document accesses."""

    class Meta:
        model = models.Document
        fields = ["id", "path", "depth"]
        read_only_fields = ["id", "path", "depth"]


class DocumentSerializer(ListDocumentSerializer):
    """Serialize documents with all fields for display in detail views."""

    websocket = serializers.BooleanField(required=False, write_only=True)
    file = serializers.FileField(
        required=False, write_only=True, allow_null=True, max_length=255
    )
    conflict_strategy = serializers.ChoiceField(
        choices=["ask", "skip", "keep_both", "replace"],
        default="ask",
        required=False,
        write_only=True,
    )

    class Meta:
        model = models.Document
        fields = [
            "id",
            "abilities",
            "ancestors_link_reach",
            "ancestors_link_role",
            "computed_link_reach",
            "computed_link_role",
            "created_at",
            "creator",
            "deleted_at",
            "depth",
            "excerpt",
            "file",
            "file_type",
            "source_name",
            "source_mime_type",
            "source_size",
            "source_sha256",
            "source_revision",
            "conflict_strategy",
            "is_favorite",
            "link_role",
            "link_reach",
            "nb_accesses_ancestors",
            "nb_accesses_direct",
            "numchild",
            "path",
            "title",
            "updated_at",
            "user_role",
            "websocket",
        ]
        read_only_fields = [
            "id",
            "abilities",
            "ancestors_link_reach",
            "ancestors_link_role",
            "computed_link_reach",
            "computed_link_role",
            "created_at",
            "creator",
            "deleted_at",
            "depth",
            "file_type",
            "is_favorite",
            "link_role",
            "link_reach",
            "nb_accesses_ancestors",
            "nb_accesses_direct",
            "numchild",
            "path",
            "source_mime_type",
            "source_name",
            "source_revision",
            "source_sha256",
            "source_size",
            "updated_at",
            "user_role",
        ]

    def get_fields(self):
        """Dynamically make `id` read-only on PUT requests but writable on POST requests."""
        fields = super().get_fields()

        request = self.context.get("request")
        if request:
            if request.method == "POST":
                fields["id"].read_only = False

        return fields

    def validate_id(self, value):
        """Ensure the provided ID is a valid UUID and not already taken."""
        request = self.context.get("request")

        # Only check this on POST (creation)
        if request and request.method == "POST":
            if value.version not in (1, 3, 4, 5):
                raise serializers.ValidationError(
                    "The provided ID is not a valid UUID."
                )

            if models.Document.objects.filter(id=value).exists():
                raise serializers.ValidationError(
                    "A document with this ID already exists. You cannot override it."
                )

        return value

    def validate_file(self, file):
        """Add file size and type constraints as defined in settings."""
        if not file:
            return None

        # Validate file size
        if file.size > settings.CONVERSION_FILE_MAX_SIZE:
            max_size = settings.CONVERSION_FILE_MAX_SIZE // (1024 * 1024)
            raise serializers.ValidationError(
                f"File size exceeds the maximum limit of {max_size:d} MB."
            )

        _name, extension = splitext(file.name)

        if extension.lower() not in settings.CONVERSION_FILE_EXTENSIONS_ALLOWED:
            raise serializers.ValidationError(
                (
                    f"File extension {extension} is not allowed. Allowed extensions"
                    f" are: {settings.CONVERSION_FILE_EXTENSIONS_ALLOWED}."
                )
            )

        return file

    def update(self, instance, validated_data):
        """
        When no data is sent on the update, skip making the update in the database and return
        directly the instance unchanged.
        """
        if not validated_data:
            return instance  # No data provided, skip the update
        return super().update(instance, validated_data)


class SearchDocumentSerializer(ListDocumentSerializer):
    """Serialize items for search."""

    parent = ListDocumentSerializer(many=False, read_only=True)

    class Meta:
        model = models.Document
        fields = ListDocumentSerializer.Meta.fields + ["parent"]
        read_only_fields = ListDocumentSerializer.Meta.read_only_fields + ["parent"]


class DocumentContentSerializer(serializers.Serializer):
    """Serializer for updating only the raw content of a document stored in S3."""

    content = serializers.CharField(required=True)
    websocket = serializers.BooleanField(required=False)

    def validate_content(self, value):
        """Validate the content field."""
        try:
            b64decode(value, validate=True)
        except binascii.Error as err:
            raise serializers.ValidationError("Invalid base64 content.") from err

        return value

    def update(self, instance, validated_data):
        """
        This serializer does not support updates.
        """
        raise NotImplementedError("Update is not supported for this serializer.")

    def create(self, validated_data):
        """
        This serializer does not support create.
        """
        raise NotImplementedError("Create is not supported for this serializer.")


class DocumentAccessSerializer(serializers.ModelSerializer):
    """Serialize document accesses."""

    document = DocumentLightSerializer(read_only=True)
    user_id = serializers.PrimaryKeyRelatedField(
        queryset=models.User.objects.all(),
        write_only=True,
        source="user",
        required=False,
        allow_null=True,
    )
    user = UserSerializer(read_only=True)
    team = serializers.CharField(required=False, allow_blank=True)
    abilities = serializers.SerializerMethodField(read_only=True)
    max_ancestors_role = serializers.SerializerMethodField(read_only=True)
    max_role = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = models.DocumentAccess
        resource_field_name = "document"
        fields = [
            "id",
            "document",
            "user",
            "user_id",
            "team",
            "role",
            "abilities",
            "max_ancestors_role",
            "max_role",
        ]
        read_only_fields = [
            "id",
            "document",
            "abilities",
            "max_ancestors_role",
            "max_role",
        ]

    def get_abilities(self, instance) -> dict:
        """Return abilities of the logged-in user on the instance."""
        request = self.context.get("request")
        if request:
            return instance.get_abilities(request.user)
        return {}

    def get_max_ancestors_role(self, instance):
        """Return max_ancestors_role if annotated; else None."""
        return getattr(instance, "max_ancestors_role", None)

    def get_max_role(self, instance):
        """Return max_ancestors_role if annotated; else None."""
        return choices.RoleChoices.max(
            getattr(instance, "max_ancestors_role", None),
            instance.role,
        )

    def update(self, instance, validated_data):
        """Make "user" field readonly but only on update."""
        validated_data.pop("team", None)
        validated_data.pop("user", None)
        return super().update(instance, validated_data)


class DocumentAccessLightSerializer(DocumentAccessSerializer):
    """Serialize document accesses with limited fields."""

    user = UserLightSerializer(read_only=True)

    class Meta:
        model = models.DocumentAccess
        resource_field_name = "document"
        fields = [
            "id",
            "document",
            "user",
            "team",
            "role",
            "abilities",
            "max_ancestors_role",
            "max_role",
        ]
        read_only_fields = [
            "id",
            "document",
            "team",
            "role",
            "abilities",
            "max_ancestors_role",
            "max_role",
        ]


class ServerCreateDocumentSerializer(serializers.Serializer):
    """
    Serializer for creating a document from a server-to-server request.

    Expects 'content' as a markdown string, which is converted to our internal format
    via a Node.js microservice. The conversion is handled automatically, so third parties
    only need to provide markdown.

    Both "sub" and "email" are required because the external app calling doesn't know
    if the user will pre-exist in Docs database. If the user pre-exist, we will ignore the
    submitted "email" field and use the email address set on the user account in our database
    """

    # Document
    title = serializers.CharField(required=True)
    content = serializers.CharField(required=True)
    # User
    sub = serializers.CharField(
        required=True, validators=[validators.sub_validator], max_length=255
    )
    email = serializers.EmailField(required=True)
    language = serializers.ChoiceField(
        required=False, choices=lazy(lambda: settings.LANGUAGES, tuple)()
    )
    # Invitation
    message = serializers.CharField(required=False)
    subject = serializers.CharField(required=False)

    def create(self, validated_data):
        """Create the document and associate it with the user or send an invitation."""
        language = validated_data.get("language", settings.LANGUAGE_CODE)

        # Get the user on its sub (unique identifier). Default on email if allowed in settings
        email = validated_data["email"]

        try:
            user = models.User.objects.get_user_by_sub_or_email(
                validated_data["sub"], email
            )
        except models.DuplicateEmailError as err:
            raise serializers.ValidationError({"email": [err.message]}) from err

        if user:
            email = user.email
            language = user.language or language

        try:
            document_content = Converter().convert(
                validated_data["content"], mime_types.MARKDOWN, mime_types.YJS
            )
        except ConversionError as err:
            raise serializers.ValidationError(
                {"content": ["Could not convert content"]}
            ) from err

        document = create_tree_node_with_retry(
            lambda: models.Document.add_root(
                title=validated_data["title"],
                creator=user,
            )
        )

        posthog_capture(PosthogEventName.DOC_CREATED, user, {}, document=document)
        posthog_capture(
            PosthogEventName.DOC_IMPORTED,
            user,
            {
                "content_type": mime_types.MARKDOWN,
                "create_for_owner": True,
            },
            document=document,
        )

        if user:
            # Associate the document with the pre-existing user
            models.DocumentAccess.objects.create(
                document=document,
                role=models.RoleChoices.OWNER,
                user=user,
            )
        else:
            # The user doesn't exist in our database: we need to invite him/her
            models.Invitation.objects.create(
                document=document,
                email=email,
                role=models.RoleChoices.OWNER,
            )

        document.content = document_content
        document.save()

        self._send_email_notification(document, validated_data, email, language)
        return document

    def _send_email_notification(self, document, validated_data, email, language):
        """Notify the user about the newly created document."""
        subject = validated_data.get("subject") or _(
            "A new document was created on your behalf!"
        )
        context = {
            "message": validated_data.get("message")
            or _("You have been granted ownership of a new document:"),
            "title": subject,
        }
        document.send_email(subject, [email], context, language)

    def update(self, instance, validated_data):
        """
        This serializer does not support updates.
        """
        raise NotImplementedError("Update is not supported for this serializer.")


class LinkDocumentSerializer(serializers.ModelSerializer):
    """
    Serialize link configuration for documents.
    We expose it separately from document in order to simplify and secure access control.
    """

    link_reach = serializers.ChoiceField(
        choices=models.LinkReachChoices.choices, required=True
    )

    class Meta:
        model = models.Document
        fields = [
            "link_role",
            "link_reach",
        ]

    def validate(self, attrs):
        """Validate that link_role and link_reach are compatible using get_select_options."""
        link_reach = attrs.get("link_reach")
        link_role = attrs.get("link_role")

        if not link_reach:
            raise serializers.ValidationError(
                {"link_reach": _("This field is required.")}
            )

        # Get available options based on ancestors' link definition
        available_options = models.LinkReachChoices.get_select_options(
            **self.instance.ancestors_link_definition
        )

        # Validate link_reach is allowed
        if link_reach not in available_options:
            msg = _(
                "Link reach '%(link_reach)s' is not allowed based on parent document configuration."
            )
            raise serializers.ValidationError(
                {"link_reach": msg % {"link_reach": link_reach}}
            )

        # Validate link_role is compatible with link_reach
        allowed_roles = available_options[link_reach]

        # Restricted reach: link_role must be None
        if link_reach == models.LinkReachChoices.RESTRICTED:
            if link_role is not None:
                raise serializers.ValidationError(
                    {
                        "link_role": (
                            "Cannot set link_role when link_reach is 'restricted'. "
                            "Link role must be null for restricted reach."
                        )
                    }
                )
            return attrs
        # Non-restricted: link_role must be in allowed roles
        if link_role not in allowed_roles:
            allowed_roles_str = ", ".join(allowed_roles) if allowed_roles else "none"
            raise serializers.ValidationError(
                {
                    "link_role": (
                        f"Link role '{link_role}' is not allowed for link reach '{link_reach}'. "
                        f"Allowed roles: {allowed_roles_str}"
                    )
                }
            )
        return attrs


class DocumentDuplicationSerializer(serializers.Serializer):
    """
    Serializer for duplicating a document.
    Allows specifying whether to keep access permissions,
    and whether to duplicate descendant documents as well
    (deep copy) or not (shallow copy).
    """

    with_accesses = serializers.BooleanField(default=False)
    with_descendants = serializers.BooleanField(default=False)

    def create(self, validated_data):
        """
        This serializer is not intended to create objects.
        """
        raise NotImplementedError("This serializer does not support creation.")

    def update(self, instance, validated_data):
        """
        This serializer is not intended to update objects.
        """
        raise NotImplementedError("This serializer does not support updating.")


# Suppress the warning about not implementing `create` and `update` methods
# since we don't use a model and only rely on the serializer for validation
# pylint: disable=abstract-method
class FileUploadSerializer(serializers.Serializer):
    """Receive file upload requests."""

    file = serializers.FileField()

    def validate_file(self, file):
        """Add file size and type constraints as defined in settings."""
        # Validate file size
        if file.size > settings.DOCUMENT_IMAGE_MAX_SIZE:
            max_size = settings.DOCUMENT_IMAGE_MAX_SIZE // (1024 * 1024)
            raise serializers.ValidationError(
                f"File size exceeds the maximum limit of {max_size:d} MB."
            )

        extension = file.name.rpartition(".")[-1] if "." in file.name else None

        # Read the first few bytes to determine the MIME type accurately
        mime = magic.Magic(mime=True)
        magic_mime_type = mime.from_buffer(file.read(1024))
        file.seek(0)  # Reset file pointer to the beginning after reading
        self.context["is_unsafe"] = False
        if settings.DOCUMENT_ATTACHMENT_CHECK_UNSAFE_MIME_TYPES_ENABLED:
            self.context["is_unsafe"] = (
                magic_mime_type in settings.DOCUMENT_UNSAFE_MIME_TYPES
            )

            extension_mime_type, _ = mimetypes.guess_type(file.name)

            # Try guessing a coherent extension from the mimetype
            if extension_mime_type != magic_mime_type:
                self.context["is_unsafe"] = True

        guessed_ext = mimetypes.guess_extension(magic_mime_type)
        # Missing extensions or extensions longer than 5 characters (it's as long as an extension
        # can be) are replaced by the extension we eventually guessed from mimetype.
        if (extension is None or len(extension) > 5) and guessed_ext:
            extension = guessed_ext[1:]

        if extension is None:
            raise serializers.ValidationError("Could not determine file extension.")

        self.context["expected_extension"] = extension
        self.context["content_type"] = magic_mime_type
        self.context["file_name"] = file.name

        return file

    def validate(self, attrs):
        """Override validate to add the computed extension to validated_data."""
        attrs["expected_extension"] = self.context["expected_extension"]
        attrs["is_unsafe"] = self.context["is_unsafe"]
        attrs["content_type"] = self.context["content_type"]
        attrs["file_name"] = self.context["file_name"]
        return attrs


class InvitationSerializer(serializers.ModelSerializer):
    """Serialize invitations."""

    abilities = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = models.Invitation
        fields = [
            "id",
            "abilities",
            "created_at",
            "email",
            "document",
            "role",
            "issuer",
            "is_expired",
        ]
        read_only_fields = [
            "id",
            "abilities",
            "created_at",
            "document",
            "issuer",
            "is_expired",
        ]

    def get_abilities(self, invitation) -> dict:
        """Return abilities of the logged-in user on the instance."""
        request = self.context.get("request")
        if request:
            return invitation.get_abilities(request.user)
        return {}

    def validate(self, attrs):
        """Validate invitation data."""
        request = self.context.get("request")
        user = getattr(request, "user", None)

        attrs["document_id"] = self.context["resource_id"]

        # Only set the issuer if the instance is being created
        if self.instance is None:
            attrs["issuer"] = user

        if attrs.get("email"):
            attrs["email"] = attrs["email"].lower()

        return attrs

    def validate_role(self, role):
        """Custom validation for the role field."""
        request = self.context.get("request")
        user = getattr(request, "user", None)
        document_id = self.context["resource_id"]

        # If the role is OWNER, check if the user has OWNER access
        if role == models.RoleChoices.OWNER:
            if not models.DocumentAccess.objects.filter(
                Q(user=user) | Q(team__in=user.teams),
                document=document_id,
                role=models.RoleChoices.OWNER,
            ).exists():
                raise serializers.ValidationError(
                    "Only owners of a document can invite other users as owners."
                )

        return role


class RoleSerializer(serializers.Serializer):
    """Serializer validating role choices."""

    role = serializers.ChoiceField(
        choices=models.RoleChoices.choices, required=False, allow_null=True
    )


class DocumentAskForAccessCreateSerializer(serializers.Serializer):
    """Serializer for creating a document ask for access."""

    role = serializers.ChoiceField(
        choices=[
            role for role in choices.RoleChoices if role != models.RoleChoices.OWNER
        ],
        required=False,
        default=models.RoleChoices.READER,
    )


class DocumentAskForAccessSerializer(serializers.ModelSerializer):
    """Serializer for document ask for access model"""

    abilities = serializers.SerializerMethodField(read_only=True)
    user = UserSerializer(read_only=True)

    class Meta:
        model = models.DocumentAskForAccess
        fields = [
            "id",
            "document",
            "user",
            "role",
            "created_at",
            "abilities",
        ]
        read_only_fields = ["id", "document", "user", "role", "created_at", "abilities"]

    def get_abilities(self, instance) -> dict:
        """Return abilities of the logged-in user on the instance."""
        request = self.context.get("request")
        if request:
            return instance.get_abilities(request.user)
        return {}


class VersionFilterSerializer(serializers.Serializer):
    """Validate version filters applied to the list endpoint."""

    version_id = serializers.CharField(required=False, allow_blank=True)
    page_size = serializers.IntegerField(
        required=False, min_value=1, max_value=50, default=20
    )


class AITransformSerializer(serializers.Serializer):
    """Serializer for AI transform requests."""

    action = serializers.ChoiceField(choices=AI_ACTIONS, required=True)
    text = serializers.CharField(required=True)

    def validate_text(self, value):
        """Ensure the text field is not empty."""

        if len(value.strip()) == 0:
            raise serializers.ValidationError("Text field cannot be empty.")
        return value


class AITranslateSerializer(serializers.Serializer):
    """Serializer for AI translate requests."""

    language = serializers.ChoiceField(
        choices=tuple(enums.ALL_LANGUAGES.items()), required=True
    )
    text = serializers.CharField(required=True)

    def validate_text(self, value):
        """Ensure the text field is not empty."""

        if len(value.strip()) == 0:
            raise serializers.ValidationError("Text field cannot be empty.")
        return value


class MoveDocumentSerializer(serializers.Serializer):
    """
    Serializer for validating input data to move a document within the tree structure.

    Fields:
        - target_document_id (UUIDField): The ID of the target parent document where the
            document should be moved. This field is required and must be a valid UUID.
        - position (ChoiceField): Specifies the position of the document in relation to
            the target parent's children.
          Choices:
            - "first-child": Place the document as the first child of the target parent.
            - "last-child": Place the document as the last child of the target parent (default).
            - "left": Place the document as the left sibling of the target parent.
            - "right": Place the document as the right sibling of the target parent.

    Example:
        Input payload for moving a document:
        {
            "target_document_id": "123e4567-e89b-12d3-a456-426614174000",
            "position": "first-child"
        }

    Notes:
        - The `target_document_id` is mandatory.
        - The `position` defaults to "last-child" if not provided.
    """

    target_document_id = serializers.UUIDField(required=True)
    position = serializers.ChoiceField(
        choices=enums.MoveNodePositionChoices.choices,
        default=enums.MoveNodePositionChoices.LAST_CHILD,
    )


class ReactionSerializer(serializers.ModelSerializer):
    """Serialize reactions."""

    users = UserLightSerializer(many=True, read_only=True)

    class Meta:
        model = models.Reaction
        fields = [
            "id",
            "emoji",
            "created_at",
            "users",
        ]
        read_only_fields = ["id", "created_at", "users"]

    def validate_emoji(self, value):
        """Ensure the reaction is a single emoji."""
        if not emoji.is_emoji(value):
            raise serializers.ValidationError("Reaction must be a single valid emoji.")
        return value


class CommentSerializer(serializers.ModelSerializer):
    """Serialize comments (nested under a thread) with reactions and abilities."""

    user = UserLightSerializer(read_only=True)
    abilities = serializers.SerializerMethodField()
    reactions = ReactionSerializer(many=True, read_only=True)

    class Meta:
        model = models.Comment
        fields = [
            "id",
            "user",
            "body",
            "created_at",
            "updated_at",
            "reactions",
            "abilities",
        ]
        read_only_fields = [
            "id",
            "user",
            "created_at",
            "updated_at",
            "reactions",
            "abilities",
        ]

    def validate(self, attrs):
        """Validate comment data."""
        attrs["thread_id"] = self.context["thread_id"]
        return attrs

    def get_abilities(self, obj):
        """Return comment's abilities."""
        request = self.context.get("request")
        if request:
            return obj.get_abilities(request.user)
        return {}


class ThreadSerializer(serializers.ModelSerializer):
    """Serialize threads in a backward compatible shape for current frontend.

    We expose a flatten representation where ``content`` maps to the first
    comment's body. Creating a thread requires a ``content`` field which is
    stored as the first comment.
    """

    creator = UserLightSerializer(read_only=True)
    abilities = serializers.SerializerMethodField(read_only=True)
    body = serializers.JSONField(write_only=True, required=True)
    comments = serializers.SerializerMethodField(read_only=True)
    comments = CommentSerializer(many=True, read_only=True)

    class Meta:
        model = models.Thread
        fields = [
            "id",
            "body",
            "created_at",
            "updated_at",
            "creator",
            "abilities",
            "comments",
            "resolved",
            "resolved_at",
            "resolved_by",
            "metadata",
        ]
        read_only_fields = [
            "id",
            "created_at",
            "updated_at",
            "creator",
            "abilities",
            "comments",
            "resolved",
            "resolved_at",
            "resolved_by",
            "metadata",
        ]

    def validate(self, attrs):
        """Validate thread data."""
        request = self.context.get("request")
        user = getattr(request, "user", None)

        attrs["document_id"] = self.context["resource_id"]
        attrs["creator_id"] = user.id if user else None

        return attrs

    def get_abilities(self, thread):
        """Return thread's abilities."""
        request = self.context.get("request")
        if request:
            return thread.get_abilities(request.user)
        return {}


class SearchQueryParamDocumentSerializer(serializers.Serializer):
    """Serializer for fulltext search requests through Find application"""

    q = serializers.CharField(required=True, allow_blank=True, trim_whitespace=True)
    document = serializers.UUIDField(required=False)
