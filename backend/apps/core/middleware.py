import logging

from django.conf import settings
from rest_framework.throttling import BaseThrottle

logger = logging.getLogger('alzaryab.client_ip')


class ClientIpDiagnosticMiddleware:
    """
    TEMPORARY, opt-in (LOG_CLIENT_IP_HEADERS=true): logs how requests to /api/health/ arrive, so the
    number of proxies in front of Django can be confirmed on a new host and TRUSTED_PROXY_COUNT set
    correctly. Logs the connection address, the X-Forwarded-For chain and the address the rate limits
    would use. Turn it off again afterwards (the log contains IP addresses).
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        if settings.LOG_CLIENT_IP_HEADERS and request.path == '/api/health/':
            ident = BaseThrottle().get_ident(request)
            logger.warning(
                'client-ip check: REMOTE_ADDR=%s X-Forwarded-For=%r NUM_PROXIES=%s → rate-limit key %s',
                request.META.get('REMOTE_ADDR'), request.META.get('HTTP_X_FORWARDED_FOR'),
                settings.REST_FRAMEWORK.get('NUM_PROXIES'), ident,
            )
        return self.get_response(request)
