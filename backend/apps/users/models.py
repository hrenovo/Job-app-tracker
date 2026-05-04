from django.contrib.auth.models import AbstractUser
from django.db import models


class User(AbstractUser):
    """
    Custom user model for the application.

    Extends Django's AbstractUser to allow future customization
    without migration conflicts.

    Add custom fields here as needed:
        phone = models.CharField(max_length=20, blank=True)
        avatar = models.ImageField(upload_to='avatars/', blank=True)
    """

    class Meta:
        db_table = 'users'
        verbose_name = 'user'
        verbose_name_plural = 'users'
