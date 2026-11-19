from django.conf import settings
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import transaction
from rest_framework import generics, status, viewsets
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.models import is_customer
from apps.accounts.serializers import CustomerRefreshSerializer
from apps.accounts.views import LoginView, RefreshView, token_response
from apps.core.permissions import IsCustomer

from .models import Address
from .password_reset import InvalidResetCode, confirm_reset, request_reset
from .serializers import (
    AddressSerializer,
    CustomerSerializer,
    PasswordResetConfirmSerializer,
    PasswordResetRequestSerializer,
    RegisterSerializer,
)

RESET_REQUESTED = (
    "If there's a customer account for this email, we've sent it a 6-digit code. "
    'It expires in {minutes} minutes. Check your spam folder if it does not arrive.'
)
RESET_INVALID = 'This code is wrong or has expired. Check the email or ask for a new code.'


RESET_UNAVAILABLE = "Password reset by email isn't available yet. Please contact the store to reset your password."


def password_reset_unavailable():
    """503 while PASSWORD_RESET_ENABLED is off (email delivery not set up and tested yet); otherwise None."""
    if settings.PASSWORD_RESET_ENABLED:
        return None
    return Response({'detail': RESET_UNAVAILABLE, 'code': 'password_reset_unavailable'}, status=status.HTTP_503_SERVICE_UNAVAILABLE)


class CustomerRegisterView(APIView):
    """POST /api/customer/auth/register/  {email, password, firstName, lastName?, phone?} → 201 {access, refresh, user}"""

    permission_classes = [AllowAny]
    authentication_classes = []
    throttle_scope = 'register'

    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        return Response(token_response(user, CustomerSerializer), status=status.HTTP_201_CREATED)


class CustomerLoginView(LoginView):
    """POST /api/customer/auth/login/  {email, password}. Staff accounts must use the admin portal."""

    role_check = staticmethod(is_customer)
    refused_message = 'This is an admin account. Please sign in to the Admin Portal instead.'
    refused_code = 'not_customer'
    user_serializer_class = CustomerSerializer


class CustomerRefreshView(RefreshView):
    """POST /api/customer/auth/refresh/  {refresh} → {access, refresh}"""

    serializer_class = CustomerRefreshSerializer


class ProfileView(generics.RetrieveUpdateAPIView):
    """GET / PATCH /api/customer/profile/"""

    serializer_class = CustomerSerializer
    permission_classes = [IsCustomer]
    http_method_names = ['get', 'patch', 'head', 'options']

    def get_object(self):
        return self.request.user


class AddressViewSet(viewsets.ModelViewSet):
    """
    /api/customer/addresses/  The signed-in customer's address book.
    The first address becomes the default; setting isDefault moves the default.
    Deleting the default promotes the most recent remaining address.
    """

    serializer_class = AddressSerializer
    permission_classes = [IsCustomer]
    pagination_class = None

    def get_queryset(self):
        return Address.objects.filter(customer=self.request.user)

    def perform_create(self, serializer):
        with transaction.atomic():
            addresses = Address.objects.select_for_update().filter(customer=self.request.user)
            if addresses.count() >= settings.MAX_ADDRESSES_PER_CUSTOMER:
                raise ValidationError({'detail': f'You can save up to {settings.MAX_ADDRESSES_PER_CUSTOMER} addresses.'})
            make_default = serializer.validated_data.get('is_default', False) or not addresses.exists()
            if make_default:
                addresses.update(is_default=False)
            serializer.save(customer=self.request.user, is_default=make_default)

    def perform_update(self, serializer):
        with transaction.atomic():
            if serializer.validated_data.get('is_default'):
                Address.objects.select_for_update().filter(customer=self.request.user).exclude(
                    pk=serializer.instance.pk
                ).update(is_default=False)
            elif serializer.instance.is_default and serializer.validated_data.get('is_default') is False:
                # There must always be a default while any address exists; pick another one instead.
                serializer.validated_data.pop('is_default')
            serializer.save()

    def perform_destroy(self, instance):
        with transaction.atomic():
            was_default = instance.is_default
            instance.delete()
            if was_default:
                replacement = Address.objects.filter(customer=self.request.user).order_by('-created_at', '-id').first()
                if replacement:
                    replacement.is_default = True
                    replacement.save(update_fields=['is_default', 'updated_at'])


class PasswordResetRequestView(APIView):
    """
    POST /api/customer/auth/password-reset/  {email} → 202, the same answer whether or not the account exists.
    An active customer account gets an email with a 6-digit code.
    """

    permission_classes = [AllowAny]
    authentication_classes = []
    throttle_scope = 'password_reset'

    def post(self, request):
        if unavailable := password_reset_unavailable():
            return unavailable
        data = PasswordResetRequestSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        request_reset(data.validated_data['email'])
        message = RESET_REQUESTED.format(minutes=settings.PASSWORD_RESET_CODE_MINUTES)
        return Response({'detail': message}, status=status.HTTP_202_ACCEPTED)


class PasswordResetConfirmView(APIView):
    """
    POST /api/customer/auth/password-reset/confirm/  {email, code, password}
    200 password changed (every existing session ends) | 400 {detail, code: 'invalid_code'} | 400 {password: [...]}
    """

    permission_classes = [AllowAny]
    authentication_classes = []
    throttle_scope = 'password_reset_confirm'

    def post(self, request):
        if unavailable := password_reset_unavailable():
            return unavailable
        data = PasswordResetConfirmSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        values = data.validated_data
        try:
            confirm_reset(values['email'], values['code'], values['password'])
        except InvalidResetCode:
            return Response({'detail': RESET_INVALID, 'code': 'invalid_code'}, status=status.HTTP_400_BAD_REQUEST)
        except DjangoValidationError as exc:
            return Response({'password': exc.messages}, status=status.HTTP_400_BAD_REQUEST)
        return Response({'detail': 'Your password has been changed. Sign in with your new password.'})
