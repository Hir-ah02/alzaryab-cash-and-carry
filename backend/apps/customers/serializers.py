from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers

from apps.accounts.models import normalize_phone, validate_phone

from .models import Address

User = get_user_model()


class PhoneField(serializers.CharField):
    """Accepts '0300-123 4567' style input and stores digits only."""

    def to_internal_value(self, data):
        raw = super().to_internal_value(data)
        value = normalize_phone(raw)
        if raw and not value.lstrip('+'):
            value = raw  # letters only: let validation reject it rather than silently blanking it
        if not value and not self.allow_blank:
            self.fail('blank')
        try:
            validate_phone(value)
        except DjangoValidationError as exc:
            raise serializers.ValidationError(exc.messages)
        return value


def ensure_phone_free(phone, user=None):
    if not phone:
        return
    taken = User.objects.filter(phone=phone)
    if user is not None:
        taken = taken.exclude(pk=user.pk)
    if taken.exists():
        raise serializers.ValidationError('This phone number is already registered.')


class CustomerSerializer(serializers.ModelSerializer):
    """The signed-in customer's own profile. Email is the login name and can't be changed here."""

    firstName = serializers.CharField(source='first_name', max_length=150)
    lastName = serializers.CharField(source='last_name', max_length=150, required=False, allow_blank=True)
    name = serializers.CharField(source='display_name', read_only=True)
    phone = PhoneField(max_length=20, required=False, allow_blank=True)
    dateJoined = serializers.DateTimeField(source='date_joined', read_only=True)

    class Meta:
        model = User
        fields = ['id', 'email', 'firstName', 'lastName', 'name', 'phone', 'dateJoined']
        read_only_fields = ['id', 'email']

    def validate_phone(self, value):
        ensure_phone_free(value, self.instance)
        return value


class RegisterSerializer(serializers.Serializer):
    email = serializers.EmailField(max_length=150)
    password = serializers.CharField(write_only=True, trim_whitespace=False, max_length=128)
    firstName = serializers.CharField(max_length=150)
    lastName = serializers.CharField(max_length=150, required=False, allow_blank=True, default='')
    phone = PhoneField(max_length=20, required=False, allow_blank=True, default='')

    def validate_email(self, value):
        value = User.objects.normalize_email(value)
        if User.objects.filter(email__iexact=value).exists() or User.objects.filter(username__iexact=value).exists():
            raise serializers.ValidationError('An account with this email already exists.')
        return value

    def validate_phone(self, value):
        ensure_phone_free(value)
        return value

    def validate(self, attrs):
        candidate = User(email=attrs['email'], first_name=attrs['firstName'], last_name=attrs['lastName'])
        try:
            validate_password(attrs['password'], user=candidate)
        except DjangoValidationError as exc:
            raise serializers.ValidationError({'password': exc.messages})
        return attrs

    def create(self, validated_data):
        # Customers never get staff or superuser rights, whatever the request contains.
        return User.objects.create_user(
            username=validated_data['email'].lower(),
            email=validated_data['email'],
            password=validated_data['password'],
            first_name=validated_data['firstName'],
            last_name=validated_data['lastName'],
            phone=validated_data['phone'],
            is_staff=False,
            is_superuser=False,
        )


class AddressSerializer(serializers.ModelSerializer):
    recipientName = serializers.CharField(source='recipient_name', max_length=100)
    phone = PhoneField(max_length=20)
    postalCode = serializers.CharField(source='postal_code', max_length=10, required=False, allow_blank=True)
    isDefault = serializers.BooleanField(source='is_default', required=False)
    createdAt = serializers.DateTimeField(source='created_at', read_only=True)
    updatedAt = serializers.DateTimeField(source='updated_at', read_only=True)

    class Meta:
        model = Address
        fields = [
            'id', 'label', 'recipientName', 'phone', 'line1', 'line2', 'area', 'city', 'postalCode',
            'instructions', 'isDefault', 'createdAt', 'updatedAt',
        ]


class PasswordResetRequestSerializer(serializers.Serializer):
    email = serializers.EmailField(max_length=150)


class PasswordResetConfirmSerializer(serializers.Serializer):
    email = serializers.EmailField(max_length=150)
    code = serializers.RegexField(r'^\d{6}$', error_messages={'invalid': 'Enter the 6-digit code from the email.'})
    password = serializers.CharField(write_only=True, trim_whitespace=False, max_length=128)
