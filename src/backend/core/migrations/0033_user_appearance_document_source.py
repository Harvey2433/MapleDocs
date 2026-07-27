from django.db import migrations, models

import core.models


class Migration(migrations.Migration):
    dependencies = [("core", "0032_remove_linktrace_is_masked")]

    operations = [
        migrations.AddField(
            model_name="user",
            name="appearance",
            field=models.JSONField(
                blank=True,
                default=dict,
                help_text="Per-user theme, color, material and background preferences.",
                verbose_name="appearance preferences",
            ),
        ),
        migrations.AddField(
            model_name="user",
            name="avatar",
            field=models.ImageField(
                blank=True,
                null=True,
                upload_to=core.models.user_avatar_upload_to,
                verbose_name="avatar",
            ),
        ),
        migrations.AddField(
            model_name="user",
            name="background_image",
            field=models.ImageField(
                blank=True,
                null=True,
                upload_to=core.models.user_background_upload_to,
                verbose_name="background image",
            ),
        ),
        migrations.AddField(
            model_name="document",
            name="file_type",
            field=models.CharField(
                choices=[
                    ("markdown", "Markdown"),
                    ("doc", "Microsoft Word 97-2003"),
                    ("docx", "Microsoft Word"),
                ],
                default="markdown",
                max_length=16,
            ),
        ),
        migrations.AddField(
            model_name="document",
            name="source_mime_type",
            field=models.CharField(blank=True, default="", max_length=127),
        ),
        migrations.AddField(
            model_name="document",
            name="source_name",
            field=models.CharField(blank=True, default="", max_length=255),
        ),
        migrations.AddField(
            model_name="document",
            name="source_revision",
            field=models.PositiveBigIntegerField(default=0),
        ),
        migrations.AddField(
            model_name="document",
            name="source_sha256",
            field=models.CharField(blank=True, db_index=True, default="", max_length=64),
        ),
        migrations.AddField(
            model_name="document",
            name="source_size",
            field=models.PositiveBigIntegerField(default=0),
        ),
    ]
