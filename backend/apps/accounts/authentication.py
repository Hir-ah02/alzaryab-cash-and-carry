from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.exceptions import AuthenticationFailed

from .tokens import matches_current_password


class PasswordBoundJWTAuthentication(JWTAuthentication):
    """SimpleJWT's bearer authentication, refusing tokens issued before the last password change."""

    def get_user(self, validated_token):
        user = super().get_user(validated_token)
        if not matches_current_password(validated_token, user):
            raise AuthenticationFailed('Your session has ended. Please sign in again.', code='password_changed')
        return user
