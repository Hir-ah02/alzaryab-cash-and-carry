from django.contrib.auth import get_user_model
from rest_framework import serializers
from rest_framework.exceptions import AuthenticationFailed
from rest_framework_simplejwt.serializers import TokenRefreshSerializer
from rest_framework_simplejwt.settings import api_settings
from rest_framework_simplejwt.tokens import RefreshToken

from .models import can_use_admin_portal, is_customer
from .tokens import matches_current_password

User = get_user_model()


class UserSerializer(serializers.ModelSerializer):
    """Safe public view of the signed-in user (no password, permissions or flags beyond role)."""

    name = serializers.CharField(source='display_name', read_only=True)
    initials = serializers.CharField(read_only=True)
    role = serializers.CharField(read_only=True)

    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'name', 'initials', 'role']
        read_only_fields = fields


class LoginSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(trim_whitespace=False, style={'input_type': 'password'})


class RefreshSerializer(TokenRefreshSerializer):
    """
    SimpleJWT's refresh (rotation + blacklist), limited to one kind of account:
    admin tokens refresh only while the user is active staff, customer tokens
    only while the user is an active non-staff customer. Returns 401, never
    500, if the token's user was deleted.
    """

    role_check = staticmethod(can_use_admin_portal)

    def validate(self, attrs):
        token = RefreshToken(attrs['refresh'])
        user = User.objects.filter(pk=token.payload.get(api_settings.USER_ID_CLAIM)).first()
        if not self.role_check(user):
            raise AuthenticationFailed('No active account found for the given token.', 'no_active_account')
        if not matches_current_password(token, user):
            # Issued before the last password change (e.g. a password reset): that session is over.
            raise AuthenticationFailed('Your session has ended. Please sign in again.', 'password_changed')
        return super().validate(attrs)


class CustomerRefreshSerializer(RefreshSerializer):
    role_check = staticmethod(is_customer)
