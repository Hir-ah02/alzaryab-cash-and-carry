"""Extra `manage.py check --deploy` checks for things Django can't know are wrong."""

from django.conf import settings
from django.core.checks import Tags, Warning, register


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
