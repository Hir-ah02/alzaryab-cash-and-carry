"""
Customer password reset with a 6-digit code sent by email.

Why a code and not a link: the customer types it into the app, so it works in
Expo Go and in store builds without deep-link setup, and nothing has to be
hosted on a website.

Rules (settings.PASSWORD_RESET_*):
  - Responses never say whether an account exists. Unknown emails, staff and
    inactive accounts get the same answer and no email.
  - Only an HMAC of the code is stored (keyed with SECRET_KEY and the user id).
  - A code expires after PASSWORD_RESET_CODE_MINUTES, works once, and is
    locked after PASSWORD_RESET_MAX_ATTEMPTS wrong tries. A new request
    cancels earlier codes. Requests are limited per account (a short resend
    pause, an hourly and a daily cap) on top of the per-IP throttles on the
    views, so one account can face at most 50 guesses a day out of 1,000,000
    codes, and its owner receives every one of those emails.
  - A successful reset changes the password, which ends every existing
    session (tokens are bound to the password, apps.accounts.tokens), and
    blacklists every outstanding refresh token as well.
"""

import logging
import secrets
import threading
from datetime import timedelta

from django.conf import settings
from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.core.mail import send_mail
from django.db import transaction
from django.utils import timezone
from django.utils.crypto import constant_time_compare, salted_hmac
from rest_framework_simplejwt.token_blacklist.models import BlacklistedToken, OutstandingToken

from apps.accounts.models import is_customer

from .models import PasswordResetCode

logger = logging.getLogger(__name__)
User = get_user_model()

CODE_DIGITS = 6


class InvalidResetCode(Exception):
    """Wrong, expired, used or locked code (or no such customer): always the same answer."""


def _code_hash(user_id, code):
    return salted_hmac('alzaryab.password-reset', f'{user_id}:{code}', algorithm='sha256').hexdigest()


def _new_code():
    return f'{secrets.randbelow(10**CODE_DIGITS):0{CODE_DIGITS}d}'


def _find_customer(email):
    user = User.objects.filter(email__iexact=(email or '').strip()).first()
    return user if is_customer(user) and user.has_usable_password() else None


def _email_body(user, code):
    minutes = settings.PASSWORD_RESET_CODE_MINUTES
    return (
        f'Hello {user.first_name or "there"},\n\n'
        f'Your Al Zaryab password reset code is: {code}\n\n'
        f'Enter it in the app within {minutes} minutes to choose a new password. '
        'The code works once.\n\n'
        "If you didn't ask to reset your password, you can ignore this email; your password stays the same.\n\n"
        'Al Zaryab Cash & Carry'
    )


def _deliver(user_id, address, subject, body):
    try:
        send_mail(subject, body, settings.DEFAULT_FROM_EMAIL, [address], fail_silently=False)
        logger.info('Password reset code emailed to user %s', user_id)
    except Exception:  # never let email problems change the API answer
        logger.exception('Could not send the password reset email to user %s', user_id)


def request_reset(email):
    """Sends a new code if the email belongs to an active customer. Returns nothing either way."""
    user = _find_customer(email)
    if user is None:
        _code_hash(0, _new_code())  # roughly the same work as the real path
        return

    now = timezone.now()
    with transaction.atomic():
        # Lock the customer's row so two simultaneous requests can't both pass the limits.
        User.objects.select_for_update().filter(pk=user.pk).first()
        codes = PasswordResetCode.objects.filter(user=user)
        if codes.filter(created_at__gt=now - timedelta(seconds=settings.PASSWORD_RESET_RESEND_SECONDS)).exists():
            return  # just sent one
        if (
            codes.filter(created_at__gt=now - timedelta(hours=1)).count() >= settings.PASSWORD_RESET_MAX_PER_HOUR
            or codes.filter(created_at__gt=now - timedelta(days=1)).count() >= settings.PASSWORD_RESET_MAX_PER_DAY
        ):
            logger.warning('Password reset limit reached for user %s', user.pk)
            return
        codes.filter(used_at__isnull=True).update(used_at=now)  # cancel older codes
        code = _new_code()
        PasswordResetCode.objects.create(
            user=user,
            code_hash=_code_hash(user.pk, code),
            expires_at=now + timedelta(minutes=settings.PASSWORD_RESET_CODE_MINUTES),
        )

    # Sent once the code is saved (the block above has committed).
    args = (user.pk, user.email, 'Your Al Zaryab password reset code', _email_body(user, code))
    if settings.PASSWORD_RESET_EMAIL_ASYNC:
        threading.Thread(target=_deliver, args=args, daemon=True).start()
    else:
        _deliver(*args)


def confirm_reset(email, code, new_password):
    """
    Sets the new password if the code is right. Raises InvalidResetCode, or
    django ValidationError (password too weak) without using up the code.
    """
    user = _find_customer(email)
    if user is None:
        _code_hash(0, code)
        raise InvalidResetCode()

    now = timezone.now()
    with transaction.atomic():
        reset = (
            PasswordResetCode.objects.select_for_update()
            .filter(user=user, used_at__isnull=True, expires_at__gt=now, attempts__lt=settings.PASSWORD_RESET_MAX_ATTEMPTS)
            .order_by('-created_at', '-id')
            .first()
        )
        if reset is None:
            raise InvalidResetCode()
        if not constant_time_compare(reset.code_hash, _code_hash(user.pk, code)):
            reset.attempts += 1
            reset.save(update_fields=['attempts'])
            wrong = True
        else:
            wrong = False
    if wrong:  # outside the block, so the counted attempt is saved
        raise InvalidResetCode()

    validate_password(new_password, user=user)  # a weak password doesn't use up the code

    with transaction.atomic():
        reset = PasswordResetCode.objects.select_for_update().get(pk=reset.pk)
        if reset.used_at is not None:  # used by a parallel request meanwhile
            raise InvalidResetCode()
        user.set_password(new_password)
        user.save(update_fields=['password'])
        PasswordResetCode.objects.filter(user=user, used_at__isnull=True).update(used_at=now)
        for token in OutstandingToken.objects.filter(user=user, blacklistedtoken__isnull=True):
            BlacklistedToken.objects.get_or_create(token=token)
    logger.info('Password reset completed for user %s', user.pk)
