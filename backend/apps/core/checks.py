"""Extra `manage.py check --deploy` checks for things Django can't know are wrong."""

from django.conf import settings
from django.core.checks import Error, Tags, Warning, register


@register(Tags.security, deploy=True)
def email_configured(app_configs, **kwargs):
    warnings = []
    if settings.EMAIL_BACKEND.endswith('smtp.EmailBackend') and not settings.EMAIL_HOST:
        warnings.append(Warning(
            'EMAIL_HOST is not set, so password reset emails cannot be sent.',
            hint='Set EMAIL_HOST, EMAIL_PORT, EMAIL_HOST_USER, EMAIL_HOST_PASSWORD and DEFAULT_FROM_EMAIL.',
            id='alzaryab.W001',
        ))
    if settings.EMAIL_BACKEND.endswith(('console.EmailBackend', 'locmem.EmailBackend', 'dummy.EmailBackend')):
        warnings.append(Warning(
            f'EMAIL_BACKEND is {settings.EMAIL_BACKEND}: emails are not delivered to customers.',
            id='alzaryab.W002',
        ))
    if 'localhost' in settings.DEFAULT_FROM_EMAIL:
        warnings.append(Warning(
            'DEFAULT_FROM_EMAIL uses localhost; customers would see an unusable sender address.',
            hint="Set DEFAULT_FROM_EMAIL to an address on the store's domain, e.g. Al Zaryab <no-reply@your-domain>.",
            id='alzaryab.W003',
        ))
    return warnings


@register(Tags.security, deploy=True)
def cors_is_https(app_configs, **kwargs):
    insecure = [o for o in settings.CORS_ALLOWED_ORIGINS if o.startswith('http://')]
    if insecure:
        return [Warning(f'CORS_ALLOWED_ORIGINS includes non-HTTPS origins: {", ".join(insecure)}', id='alzaryab.W004')]
    return []


@register(Tags.security, deploy=True)
def client_ip_detection(app_configs, **kwargs):
    """Per-IP rate limits only work if Django knows which part of X-Forwarded-For to trust."""
    num_proxies = settings.REST_FRAMEWORK.get('NUM_PROXIES')
    if num_proxies is None:
        return [Error(
            'REST_FRAMEWORK NUM_PROXIES is None: clients can forge X-Forwarded-For to bypass rate limits.',
            hint='Set TRUSTED_PROXY_COUNT (1 behind nginx, 0 without a proxy).',
            id='alzaryab.E001',
        )]
    if getattr(settings, 'SECURE_PROXY_SSL_HEADER', None) and num_proxies == 0:
        return [Warning(
            'DJANGO_BEHIND_PROXY is on but TRUSTED_PROXY_COUNT is 0: every visitor will share the proxy\'s IP '
            'address, so one busy client can rate-limit everyone.',
            hint='Set TRUSTED_PROXY_COUNT=1 for a single nginx in front of gunicorn.',
            id='alzaryab.W005',
        )]
    return []


@register(Tags.security, deploy=True)
def password_reset_needs_email(app_configs, **kwargs):
    if not settings.PASSWORD_RESET_ENABLED:
        return [Warning(
            'PASSWORD_RESET_ENABLED is off: customers are told to contact the store to reset a password.',
            hint='Turn it on only after email delivery is configured and a test reset email has arrived.',
            id='alzaryab.W006',
        )]
    if settings.EMAIL_BACKEND.endswith('smtp.EmailBackend') and not settings.EMAIL_HOST:
        return [Error(
            'PASSWORD_RESET_ENABLED is on but EMAIL_HOST is not set: reset codes would never arrive.',
            hint='Configure EMAIL_* or set PASSWORD_RESET_ENABLED=false.',
            id='alzaryab.E002',
        )]
    return []
