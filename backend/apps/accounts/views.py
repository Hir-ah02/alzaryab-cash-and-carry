from django.contrib.auth import get_user_model
from django.contrib.auth.hashers import check_password, make_password
from django.contrib.auth.models import update_last_login
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAdminUser
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.tokens import RefreshToken

from .tokens import AccountRefreshToken
from rest_framework_simplejwt.views import TokenRefreshView

from .models import can_use_admin_portal
from .serializers import LoginSerializer, RefreshSerializer, UserSerializer

User = get_user_model()

# Checked against when the email is unknown, so a wrong email takes as long as a wrong password.
_DUMMY_PASSWORD_HASH = make_password(None)


class LoginView(APIView):
    """
    POST /api/auth/login/  {email, password}
    200 {access, refresh, user} | 401 wrong email or password | 403 not an admin

    Subclasses change role_check / refused_message / user_serializer_class
    for other kinds of account (see apps.customers).
    """

    permission_classes = [AllowAny]
    authentication_classes = []
    throttle_scope = 'login'
    role_check = staticmethod(can_use_admin_portal)
    refused_message = "This account doesn't have access to the Admin Portal."
    refused_code = 'not_staff'
    user_serializer_class = UserSerializer

    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        email = serializer.validated_data['email']
        password = serializer.validated_data['password']

        user = User.objects.filter(email__iexact=email).first()
        if user is None:
            check_password(password, _DUMMY_PASSWORD_HASH)
            return self._invalid()
        if not user.check_password(password) or not user.is_active:
            return self._invalid()
        if not self.role_check(user):
            return Response({'detail': self.refused_message, 'code': self.refused_code}, status=status.HTTP_403_FORBIDDEN)
        return Response(token_response(user, self.user_serializer_class))

    @staticmethod
    def _invalid():
        return Response(
            {'detail': 'Incorrect email or password.', 'code': 'invalid_credentials'},
            status=status.HTTP_401_UNAUTHORIZED,
        )


def token_response(user, user_serializer_class):
    """{access, refresh, user} for a user who has just signed in or registered."""
    refresh = AccountRefreshToken.for_user(user)
    update_last_login(None, user)
    return {
        'access': str(refresh.access_token),
        'refresh': str(refresh),
        'user': user_serializer_class(user).data,
    }


class RefreshView(TokenRefreshView):
    """
    POST /api/auth/refresh/  {refresh}
    200 {access, refresh}: the old refresh token is blacklisted (rotation).
    401 if the token is expired, blacklisted, or the user is no longer active staff.
    """

    serializer_class = RefreshSerializer
    authentication_classes = []
    throttle_scope = 'refresh'


class LogoutView(APIView):
    """POST /api/auth/logout/  {refresh} → 204. Blacklists the refresh token so it can't be reused."""

    permission_classes = [AllowAny]
    authentication_classes = []
    throttle_scope = 'refresh'

    def post(self, request):
        token = request.data.get('refresh') if hasattr(request.data, 'get') else None
        if not token:
            return Response({'refresh': ['This field is required.']}, status=status.HTTP_400_BAD_REQUEST)
        try:
            RefreshToken(token).blacklist()
        except TokenError:
            # Already expired or blacklisted: the session is over either way.
            pass
        return Response(status=status.HTTP_204_NO_CONTENT)


class MeView(APIView):
    """GET /api/auth/me/ → the signed-in admin."""

    permission_classes = [IsAdminUser]

    def get(self, request):
        return Response(UserSerializer(request.user).data)
