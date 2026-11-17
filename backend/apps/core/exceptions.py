import logging

from django.db import IntegrityError
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import exception_handler

logger = logging.getLogger(__name__)


def api_exception_handler(exc, context):
    """DRF's handler, plus a 409 for database constraint violations instead of a 500."""
    response = exception_handler(exc, context)
    if response is None and isinstance(exc, IntegrityError):
        logger.warning('Integrity error in %s: %s', context.get('view'), exc)
        return Response(
            {'detail': 'This change conflicts with existing data. Please refresh and try again.'},
            status=status.HTTP_409_CONFLICT,
        )
    return response
