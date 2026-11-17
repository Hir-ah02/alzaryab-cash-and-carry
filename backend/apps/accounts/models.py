import re

from django.contrib.auth.models import AbstractUser
from django.core.exceptions import ValidationError
from django.db import models
from django.db.models.functions import Lower

PHONE_PATTERN = re.compile(r'^\+?\d{10,15}$')


def normalize_phone(value):
    """'0300-123 4567' → '03001234567'. Keeps a leading +."""
    value = (value or '').strip()
    return ('+' if value.startswith('+') else '') + re.sub(r'\D', '', value)


def validate_phone(value):
    if value and not PHONE_PATTERN.match(value):
        raise ValidationError('Enter a valid phone number, e.g. 03001234567 or +923001234567.')


class User(AbstractUser):
    """
    One account model for everyone who signs in:
      - admins: is_staff=True, use the admin portal
      - customers: is_staff=False, use the customer API (register themselves)
    Admins sign in with their email address; customers with email too.
    """

    # Required (createsuperuser asks for it) and unique, because it is the login name.
    email = models.EmailField('email address')
    phone = models.CharField(max_length=16, blank=True, validators=[validate_phone])

    class Meta(AbstractUser.Meta):
        constraints = [
            # Blank emails (users created in code without one) can't sign in, so aren't checked.
            models.UniqueConstraint(Lower('email'), condition=~models.Q(email=''), name='user_email_unique_ci'),
            models.UniqueConstraint(fields=['phone'], condition=~models.Q(phone=''), name='user_phone_unique'),
        ]

    @property
    def display_name(self):
        return self.get_full_name() or self.get_username()

    @property
    def initials(self):
        parts = self.display_name.split()
        letters = ''.join(part[0] for part in parts[:2]) if parts else self.get_username()[:2]
        return letters.upper()

    @property
    def role(self):
        return 'Owner' if self.is_superuser else 'Admin'


def can_use_admin_portal(user):
    """Admin login and admin token refresh: only active staff."""
    return user is not None and user.is_active and user.is_staff


def is_customer(user):
    """Customer login and customer API: active accounts without staff rights."""
    return user is not None and user.is_active and not user.is_staff


def is_active_user(user):
    """SimpleJWT's general rule; each refresh endpoint adds its own role check."""
    return user is not None and user.is_active
