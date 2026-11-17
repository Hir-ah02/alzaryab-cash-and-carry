from django.conf import settings
from django.db import models

from apps.accounts.models import validate_phone


class Address(models.Model):
    """A customer's saved delivery address. Orders copy it, so editing or deleting it never changes past orders."""

    customer = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='addresses')
    label = models.CharField(max_length=30, blank=True, help_text='e.g. Home, Work')
    recipient_name = models.CharField(max_length=100)
    phone = models.CharField(max_length=16, validators=[validate_phone])
    line1 = models.CharField('house / street', max_length=200)
    line2 = models.CharField('apartment / landmark', max_length=200, blank=True)
    area = models.CharField(max_length=100)
    city = models.CharField(max_length=60)
    postal_code = models.CharField(max_length=10, blank=True)
    instructions = models.CharField(max_length=255, blank=True)
    is_default = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name_plural = 'addresses'
        ordering = ['-is_default', '-created_at', '-id']
        constraints = [
            models.UniqueConstraint(
                fields=['customer'], condition=models.Q(is_default=True), name='address_one_default_per_customer'
            ),
        ]

    def __str__(self):
        return f'{self.recipient_name}, {self.line1}, {self.area}, {self.city}'


class PasswordResetCode(models.Model):
    """
    A one-time code emailed to a customer who forgot their password.
    Only an HMAC of the code is stored. A code works once, until it expires
    (PASSWORD_RESET_CODE_MINUTES) or after PASSWORD_RESET_MAX_ATTEMPTS wrong
    tries, and asking for a new code cancels the old ones.
    """

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='password_reset_codes')
    code_hash = models.CharField(max_length=64)
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()
    attempts = models.PositiveSmallIntegerField(default=0)
    used_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-created_at', '-id']
        indexes = [models.Index(fields=['user', '-created_at'], name='reset_code_user_created_idx')]

    def __str__(self):
        return f'Password reset code for {self.user} ({self.created_at:%Y-%m-%d %H:%M})'
