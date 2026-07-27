"""Create or repair a local MapleDocs administrator account."""

import getpass
import os

from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError
from django.core.management.base import BaseCommand, CommandError
from django.core.validators import validate_email
from django.db import transaction
from django.db.models import Q

from core.models import User


class Command(BaseCommand):
    """Create a login-capable administrator for local authentication."""

    help = "Create or repair a local MapleDocs administrator account."
    requires_migrations_checks = True

    def add_arguments(self, parser):
        parser.add_argument("--email", help="Administrator login email.")
        parser.add_argument("--name", help="Administrator display name.")
        parser.add_argument(
            "--noinput",
            "--no-input",
            action="store_false",
            dest="interactive",
            help=(
                "Read MAPLEDOCS_ADMIN_EMAIL and MAPLEDOCS_ADMIN_PASSWORD instead "
                "of prompting."
            ),
        )

    def handle(self, *args, **options):
        interactive = options["interactive"]
        email = options["email"] or os.getenv("MAPLEDOCS_ADMIN_EMAIL")
        name = options["name"] or os.getenv("MAPLEDOCS_ADMIN_NAME")

        if interactive and not email:
            email = input("Admin email: ").strip()
        email = (email or "").strip().lower()
        try:
            validate_email(email)
        except ValidationError as err:
            raise CommandError("A valid administrator email is required.") from err

        if interactive and not name:
            default_name = email.split("@", maxsplit=1)[0]
            name = input(f"Display name [{default_name}]: ").strip() or default_name
        name = (name or email.split("@", maxsplit=1)[0]).strip()

        user = self._find_account(email)
        password = self._get_password(user, interactive)

        with transaction.atomic():
            created = user is None
            if user is None:
                user = User()
            user.admin_email = email
            user.email = email
            user.full_name = name
            user.short_name = name
            user.is_active = True
            user.is_staff = True
            user.is_superuser = True
            user.set_password(password)
            user.save()

        action = "created" if created else "updated"
        self.stdout.write(self.style.SUCCESS(f"Administrator {email} {action}."))

    @staticmethod
    def _find_account(email):
        user = User.objects.filter(
            Q(admin_email__iexact=email) | Q(email__iexact=email)
        ).first()
        if user is not None:
            return user

        return (
            User.objects.filter(
                is_superuser=True,
                admin_email__isnull=True,
                email__isnull=True,
            )
            .order_by("-created_at")
            .first()
        )

    def _get_password(self, user, interactive):
        if not interactive:
            password = os.getenv("MAPLEDOCS_ADMIN_PASSWORD", "")
            if not password:
                raise CommandError(
                    "MAPLEDOCS_ADMIN_PASSWORD is required with --noinput."
                )
            self._validate_password(password, user)
            return password

        while True:
            password = getpass.getpass("Password: ")
            confirmation = getpass.getpass("Password (again): ")
            if password != confirmation:
                self.stderr.write("Error: Passwords do not match.")
                continue
            try:
                self._validate_password(password, user)
            except CommandError as err:
                self.stderr.write(str(err))
                continue
            return password

    @staticmethod
    def _validate_password(password, user):
        try:
            validate_password(password, user=user)
        except ValidationError as err:
            raise CommandError(" ".join(err.messages)) from err
