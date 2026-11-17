"""
JWTs tied to the account's current password.

Every token carries a short fingerprint of the user's password hash (an HMAC
keyed with SECRET_KEY, so it reveals nothing about the password). When the
password changes, for example through password reset, the fingerprint no
longer matches and every access and refresh token issued before is refused at
once, on every device. This is the JWT equivalent of Django's
session-invalidation-on-password-change (get_session_auth_hash).
"""

from django.utils.crypto import constant_time_compare, salted_hmac
from rest_framework_simplejwt.tokens import RefreshToken

PASSWORD_CLAIM = 'pwd'


def password_fingerprint(user):
    return salted_hmac('alzaryab.jwt.password', user.password, algorithm='sha256').hexdigest()[:24]


def matches_current_password(token, user):
    """False for tokens issued before the last password change (or without a fingerprint)."""
    claim = token.get(PASSWORD_CLAIM)
    return isinstance(claim, str) and constant_time_compare(claim, password_fingerprint(user))


class AccountRefreshToken(RefreshToken):
    """RefreshToken.for_user plus the password fingerprint; access tokens made from it copy the claim."""

    @classmethod
    def for_user(cls, user):
        token = super().for_user(user)
        token[PASSWORD_CLAIM] = password_fingerprint(user)
        return token
