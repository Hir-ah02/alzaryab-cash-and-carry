"""
Django settings for the Alzaryab Cash & Carry backend.

All environment-specific values come from environment variables, loaded
from backend/.env in development (see .env.example).
"""

import os
import re
from datetime import timedelta
from decimal import Decimal
from pathlib import Path

from django.core.exceptions import ImproperlyConfigured
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent

load_dotenv(BASE_DIR / '.env')


def env(name, default=None, required=False):
    value = os.environ.get(name, default)
    if required and not value:
        raise ImproperlyConfigured(f'Missing required environment variable: {name}')
    return value


def env_bool(name, default=False):
    return env(name, str(default)).strip().lower() in {'1', 'true', 'yes', 'on'}


def env_list(name, default=''):
    return [item.strip() for item in env(name, default).split(',') if item.strip()]


SECRET_KEY = env('DJANGO_SECRET_KEY', required=True)
# Off unless explicitly turned on: a missing variable can never put a server into debug mode.
DEBUG = env_bool('DJANGO_DEBUG', False)
ALLOWED_HOSTS = env_list('DJANGO_ALLOWED_HOSTS', 'localhost,127.0.0.1' if DEBUG else '')

if not DEBUG:
    # Production must be configured on purpose; refuse to start with development leftovers.
    if len(SECRET_KEY) < 50 or SECRET_KEY.startswith(('change-me', 'django-insecure', 'test-')):
        raise ImproperlyConfigured('DJANGO_SECRET_KEY must be a long random value (50+ characters) in production.')
    if not ALLOWED_HOSTS or '*' in ALLOWED_HOSTS:
        raise ImproperlyConfigured('Set DJANGO_ALLOWED_HOSTS to the API domain(s) in production.')
    if not env('DB_PASSWORD'):
        raise ImproperlyConfigured(
            'DB_PASSWORD is required in production: the database must use password (scram-sha-256) authentication, not trust.'
        )


# Application definition

INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    # Third party
    'rest_framework',
    'rest_framework_simplejwt.token_blacklist',
    'corsheaders',
    # Local
    'apps.core',
    'apps.accounts',
    'apps.catalog',
    'apps.inventory',
    'apps.customers',
    'apps.orders',
]

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'corsheaders.middleware.CorsMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'config.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'config.wsgi.application'


# Database (PostgreSQL)

DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql',
        'NAME': env('DB_NAME', required=True),
        'USER': env('DB_USER', required=True),
        'PASSWORD': env('DB_PASSWORD', ''),
        'HOST': env('DB_HOST', 'localhost'),
        'PORT': env('DB_PORT', '5432'),
        'CONN_MAX_AGE': int(env('DB_CONN_MAX_AGE', '60')),
        'CONN_HEALTH_CHECKS': True,
    }
}

# Optional: use a separate PostgreSQL schema inside the same database (e.g. an
# isolated copy for browser tests). Leave unset to use the normal "public" schema.
DB_SCHEMA = env('DB_SCHEMA', '')
if DB_SCHEMA:
    if not re.fullmatch(r'[a-z_][a-z0-9_]{0,62}', DB_SCHEMA):
        raise ImproperlyConfigured('DB_SCHEMA must be a simple lowercase identifier.')
    DATABASES['default']['OPTIONS'] = {'options': f'-c search_path={DB_SCHEMA}'}


# Authentication

# Custom user model, set before the first migration so it can be extended
# later (e.g. phone number for customers) without a painful migration.
AUTH_USER_MODEL = 'accounts.User'

AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'},
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator'},
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},
    {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator'},
]


# Internationalization

LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'Asia/Karachi'
USE_I18N = True
USE_TZ = True


# Static and media files

STATIC_URL = 'static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'
MEDIA_URL = 'media/'
MEDIA_ROOT = BASE_DIR / 'media'

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'


# Django REST Framework

REST_FRAMEWORK = {
    # The API is used by the React portal with JWT bearer tokens only.
    # SimpleJWT bearer tokens, refused once the account's password has changed (apps.accounts.tokens).
    'DEFAULT_AUTHENTICATION_CLASSES': ['apps.accounts.authentication.PasswordBoundJWTAuthentication'],
    # Secure by default: public endpoints must opt in with AllowAny.
    'DEFAULT_PERMISSION_CLASSES': ['rest_framework.permissions.IsAuthenticated'],
    # Per-endpoint limits (throttle_scope) plus overall limits per IP (anonymous) and per account.
    'DEFAULT_THROTTLE_CLASSES': [
        'rest_framework.throttling.ScopedRateThrottle',
        'rest_framework.throttling.AnonRateThrottle',
        'rest_framework.throttling.UserRateThrottle',
    ],
    'DEFAULT_THROTTLE_RATES': {
        'login': env('LOGIN_THROTTLE_RATE', '10/min'),
        'register': env('REGISTER_THROTTLE_RATE', '20/hour'),
        'refresh': env('REFRESH_THROTTLE_RATE', '60/min'),
        'password_reset': env('PASSWORD_RESET_THROTTLE_RATE', '10/hour'),
        'password_reset_confirm': env('PASSWORD_RESET_CONFIRM_THROTTLE_RATE', '20/hour'),
        'anon': env('ANON_THROTTLE_RATE', '300/min'),
        'user': env('USER_THROTTLE_RATE', '600/min'),
    },
    'DEFAULT_PAGINATION_CLASS': 'apps.core.pagination.StandardPagination',
    # JSON only in production; the browsable HTML API is a development convenience.
    'DEFAULT_RENDERER_CLASSES': ['rest_framework.renderers.JSONRenderer']
    + (['rest_framework.renderers.BrowsableAPIRenderer'] if DEBUG else []),
    'EXCEPTION_HANDLER': 'apps.core.exceptions.api_exception_handler',
}


# JWT authentication (admin portal)
# Development: the portal keeps tokens in browser storage. See backend/README.md
# for the production setup (HTTPS, httpOnly refresh cookie, CSRF).

SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(minutes=int(env('JWT_ACCESS_MINUTES', '15'))),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=int(env('JWT_REFRESH_DAYS', '7'))),
    'ROTATE_REFRESH_TOKENS': True,
    'BLACKLIST_AFTER_ROTATION': True,
    'AUTH_HEADER_TYPES': ('Bearer',),
    # Admin vs customer is checked by each login and refresh endpoint (apps.accounts).
    'USER_AUTHENTICATION_RULE': 'apps.accounts.models.is_active_user',
}


# Password reset (customers; see apps/customers/password_reset.py)

PASSWORD_RESET_CODE_MINUTES = int(env('PASSWORD_RESET_CODE_MINUTES', '15'))
PASSWORD_RESET_MAX_ATTEMPTS = 5  # wrong codes before a code is locked
PASSWORD_RESET_RESEND_SECONDS = 60  # pause between emails to one account
PASSWORD_RESET_MAX_PER_HOUR = 5  # emails per account per hour
PASSWORD_RESET_MAX_PER_DAY = 10  # …and per day: at most 50 code guesses a day against one account
PASSWORD_RESET_EMAIL_ASYNC = True  # send after responding, so timing can't reveal whether an account exists


# Email. Development prints emails (with reset codes) to the runserver console.
# Production: an SMTP provider from environment variables (see docs/DEPLOYMENT.md).

EMAIL_BACKEND = env(
    'EMAIL_BACKEND',
    'django.core.mail.backends.console.EmailBackend' if DEBUG else 'django.core.mail.backends.smtp.EmailBackend',
)
EMAIL_HOST = env('EMAIL_HOST', '')
EMAIL_PORT = int(env('EMAIL_PORT', '587'))
EMAIL_HOST_USER = env('EMAIL_HOST_USER', '')
EMAIL_HOST_PASSWORD = env('EMAIL_HOST_PASSWORD', '')
EMAIL_USE_TLS = env_bool('EMAIL_USE_TLS', True)
EMAIL_USE_SSL = env_bool('EMAIL_USE_SSL', False)
EMAIL_TIMEOUT = 15
DEFAULT_FROM_EMAIL = env('DEFAULT_FROM_EMAIL', 'Al Zaryab <no-reply@localhost>')
if env('EMAIL_FILE_PATH'):  # with EMAIL_BACKEND=django.core.mail.backends.filebased.EmailBackend (testing)
    EMAIL_FILE_PATH = env('EMAIL_FILE_PATH')
SERVER_EMAIL = DEFAULT_FROM_EMAIL


# Inventory rules (match src/utils/stock.js and src/utils/image.js in the admin portal)

LOW_STOCK_THRESHOLD = 5  # 1-5 units = low stock, 0 = out of stock
PRODUCT_IMAGE_MAX_BYTES = 5 * 1024 * 1024  # 5 MB


# Orders (Cash on Delivery). Fees are placeholders until the store confirms them.

ORDER_DELIVERY_FEE = Decimal(env('ORDER_DELIVERY_FEE', '150.00'))
# Orders with a subtotal at or above this get free delivery. Leave empty to always charge.
ORDER_FREE_DELIVERY_FROM = Decimal(env('ORDER_FREE_DELIVERY_FROM')) if env('ORDER_FREE_DELIVERY_FROM') else None
ORDER_MAX_LINES = 50
ORDER_MAX_QUANTITY_PER_ITEM = 100
MAX_ADDRESSES_PER_CUSTOMER = 10


# CORS: browser origins allowed to call the API (the admin portal). Native apps don't use CORS.
# Development defaults to the Vite dev server; production allows nothing unless configured.

CORS_ALLOWED_ORIGINS = env_list('CORS_ALLOWED_ORIGINS', 'http://localhost:5173,http://127.0.0.1:5173' if DEBUG else '')
# Origins trusted for Django admin (/admin/) form posts over HTTPS, e.g. https://api.example.com
CSRF_TRUSTED_ORIGINS = env_list('CSRF_TRUSTED_ORIGINS', '')


# HTTPS and security headers. Everything is on in production (DEBUG off) and off in development.

SECURE_SSL_REDIRECT = env_bool('SECURE_SSL_REDIRECT', not DEBUG)
SESSION_COOKIE_SECURE = not DEBUG
CSRF_COOKIE_SECURE = not DEBUG
SESSION_COOKIE_HTTPONLY = True
# Start with a day; raise to 31536000 (a year) once HTTPS is confirmed working on every subdomain in use.
SECURE_HSTS_SECONDS = int(env('SECURE_HSTS_SECONDS', '0' if DEBUG else '86400'))
SECURE_HSTS_INCLUDE_SUBDOMAINS = env_bool('SECURE_HSTS_INCLUDE_SUBDOMAINS', False)
SECURE_HSTS_PRELOAD = False
SECURE_CONTENT_TYPE_NOSNIFF = True
SECURE_REFERRER_POLICY = 'same-origin'
X_FRAME_OPTIONS = 'DENY'
# Behind a reverse proxy / load balancer that terminates HTTPS (nginx, Render, Railway…), set
# DJANGO_BEHIND_PROXY=true so Django trusts its X-Forwarded-Proto header. Never set it without a proxy.
if env_bool('DJANGO_BEHIND_PROXY', False):
    SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')
    USE_X_FORWARDED_HOST = False

# Django's own admin site: on at /admin/ in development; off in production unless a path is given.
DJANGO_ADMIN_PATH = env('DJANGO_ADMIN_PATH', 'admin/' if DEBUG else '')
if DJANGO_ADMIN_PATH and not DJANGO_ADMIN_PATH.endswith('/'):
    DJANGO_ADMIN_PATH += '/'

# Uploads: images are limited to PRODUCT_IMAGE_MAX_BYTES in the API; other request bodies stay small.
DATA_UPLOAD_MAX_MEMORY_SIZE = 2_621_440  # 2.5 MB of non-file data
FILE_UPLOAD_PERMISSIONS = 0o644


# Cache (used by rate limiting). The default is per process; with several server
# processes set DJANGO_CACHE=database and run `manage.py createcachetable` once,
# so limits are shared.

if env('DJANGO_CACHE', '') == 'database':
    CACHES = {'default': {'BACKEND': 'django.core.cache.backends.db.DatabaseCache', 'LOCATION': 'django_cache'}}


# Logging to stdout/stderr (collected by the process manager or host). Never logs passwords,
# tokens or reset codes.

LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'formatters': {'standard': {'format': '%(asctime)s %(levelname)s %(name)s: %(message)s'}},
    'handlers': {'console': {'class': 'logging.StreamHandler', 'formatter': 'standard'}},
    'root': {'handlers': ['console'], 'level': env('DJANGO_LOG_LEVEL', 'INFO')},
    'loggers': {
        'django': {'handlers': ['console'], 'level': env('DJANGO_LOG_LEVEL', 'INFO'), 'propagate': False},
        # 4xx responses are normal for an API; log only server errors and security events.
        'django.request': {'handlers': ['console'], 'level': 'ERROR', 'propagate': False},
        'django.security': {'handlers': ['console'], 'level': 'WARNING', 'propagate': False},
        # Requests for other host names (internet scanners) are refused with 400; don't fill the logs with them.
        'django.security.DisallowedHost': {'handlers': ['console'], 'level': 'CRITICAL', 'propagate': False},
    },
}
