"""
Settings for the automated test suite: python manage.py test --settings=config.settings_test

Tests run against a throwaway in-memory SQLite database, so they never touch
alzaryab_db and need no extra PostgreSQL privileges. PostgreSQL-specific
behaviour is verified separately against alzaryab_db.
"""

import os
import tempfile

os.environ.setdefault('DJANGO_SECRET_KEY', 'test-only-secret-key')
# The test runner switches DEBUG off itself; this only skips the production start-up checks.
os.environ.setdefault('DJANGO_DEBUG', 'True')
os.environ.setdefault('DB_NAME', 'unused')
os.environ.setdefault('DB_USER', 'unused')

from .settings import *  # noqa: E402,F403

DATABASES = {'default': {'ENGINE': 'django.db.backends.sqlite3', 'NAME': ':memory:'}}
MEDIA_ROOT = tempfile.mkdtemp(prefix='alzaryab-test-media-')
PASSWORD_HASHERS = ['django.contrib.auth.hashers.MD5PasswordHasher']

EMAIL_BACKEND = 'django.core.mail.backends.locmem.EmailBackend'
PASSWORD_RESET_EMAIL_ASYNC = False  # send inside the request so tests can read mail.outbox
LOGGING = {'version': 1, 'disable_existing_loggers': False, 'root': {'level': 'CRITICAL'}}
# Overall per-IP / per-account limits are generous for real use but a full test run would hit them.
REST_FRAMEWORK = {
    **REST_FRAMEWORK,  # noqa: F405
    'DEFAULT_THROTTLE_RATES': {**REST_FRAMEWORK['DEFAULT_THROTTLE_RATES'], 'anon': '100000/min', 'user': '100000/min'},  # noqa: F405
}
