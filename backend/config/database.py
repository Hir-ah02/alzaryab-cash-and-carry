"""
Database settings for every environment.

Local development (unchanged): DB_NAME, DB_USER, DB_PASSWORD, DB_HOST, DB_PORT from backend/.env.

Hosted (Render + Supabase): DATABASE_URL, set ONLY in the hosting dashboard, never in a file:
    postgresql://USER:PASSWORD@HOST:PORT/DBNAME
Special characters in the password must be percent-encoded (Supabase's "copy" button does this).

TLS (hosted databases):
    DB_SSLMODE      verify-full (default in production) | verify-ca | require
                    verify-full encrypts AND checks the server's certificate and host name.
                    require encrypts but does not check who is answering (use only temporarily).
    DB_SSLROOTCERT  path to the CA certificate that signed the database's certificate (for Supabase:
                    the "SSL certificate" downloaded from the project's database settings). It is a
                    public certificate, not a secret.
Production refuses to start without TLS, or with verify-* and no readable certificate file.
"""

from pathlib import Path
from urllib.parse import parse_qsl, unquote, urlsplit

from django.core.exceptions import ImproperlyConfigured

SECURE_SSLMODES = ('require', 'verify-ca', 'verify-full')
VERIFYING_SSLMODES = ('verify-ca', 'verify-full')
ALL_SSLMODES = ('disable', 'allow', 'prefer') + SECURE_SSLMODES
# libpq connection options that may appear in DATABASE_URL's query string.
URL_OPTIONS = {'sslmode', 'sslrootcert', 'connect_timeout', 'application_name', 'target_session_attrs'}


def parse_database_url(url):
    """postgresql://user:pass@host:port/name?sslmode=… → Django connection fields + libpq options."""
    parts = urlsplit(url)
    if parts.scheme not in ('postgres', 'postgresql'):
        raise ImproperlyConfigured('DATABASE_URL must start with postgresql:// (or postgres://).')
    name = unquote(parts.path.lstrip('/'))
    if not parts.hostname or not name or not parts.username:
        raise ImproperlyConfigured('DATABASE_URL must include a user, a host and a database name.')
    try:
        port = parts.port or 5432
    except ValueError:
        raise ImproperlyConfigured('DATABASE_URL has an invalid port.') from None
    options = {}
    for key, value in parse_qsl(parts.query, keep_blank_values=True):
        if key not in URL_OPTIONS:
            raise ImproperlyConfigured(f'DATABASE_URL option "{key}" is not supported here.')
        options[key] = value
    return {
        'NAME': name,
        'USER': unquote(parts.username),
        'PASSWORD': unquote(parts.password or ''),
        'HOST': parts.hostname,
        'PORT': str(port),
    }, options


def _tls_options(environ, url_options, *, debug):
    sslmode = (environ.get('DB_SSLMODE') or url_options.get('sslmode') or ('' if debug else 'verify-full')).strip()
    rootcert = (environ.get('DB_SSLROOTCERT') or url_options.get('sslrootcert') or '').strip()
    if sslmode and sslmode not in ALL_SSLMODES:
        raise ImproperlyConfigured(f'DB_SSLMODE must be one of: {", ".join(ALL_SSLMODES)}.')
    if not debug:
        if sslmode not in SECURE_SSLMODES:
            raise ImproperlyConfigured('A hosted database must use TLS: set DB_SSLMODE to verify-full (recommended) or require.')
        if sslmode in VERIFYING_SSLMODES:
            if not rootcert:
                raise ImproperlyConfigured(
                    f'DB_SSLMODE={sslmode} needs DB_SSLROOTCERT: the path of the database provider\'s CA certificate '
                    '(Supabase: Database settings → SSL configuration → Download certificate).'
                )
            if rootcert != 'system' and not Path(rootcert).is_file():
                raise ImproperlyConfigured(f'DB_SSLROOTCERT file not found: {rootcert}')
    options = {}
    if sslmode:
        options['sslmode'] = sslmode
    if rootcert:
        options['sslrootcert'] = rootcert
    return options


def build_database_settings(environ, *, debug):
    """The DATABASES['default'] dict for this environment (environ: a mapping like os.environ)."""
    config = {
        'ENGINE': 'django.db.backends.postgresql',
        'CONN_MAX_AGE': int(environ.get('DB_CONN_MAX_AGE', '60')),
        'CONN_HEALTH_CHECKS': True,
    }
    url = environ.get('DATABASE_URL', '').strip()
    if url:
        fields, url_options = parse_database_url(url)
        if not debug and not fields['PASSWORD']:
            raise ImproperlyConfigured('DATABASE_URL must include the database password in production.')
        options = {k: v for k, v in url_options.items() if k not in ('sslmode', 'sslrootcert')}
        options.setdefault('connect_timeout', '10')
        options.update(_tls_options(environ, url_options, debug=debug))
        config.update(fields)
        config['OPTIONS'] = options
        return config

    # Local / self-hosted PostgreSQL (the development setup; unchanged).
    for required in ('DB_NAME', 'DB_USER'):
        if not environ.get(required):
            raise ImproperlyConfigured(f'Missing required environment variable: {required} (or set DATABASE_URL)')
    if not debug and not environ.get('DB_PASSWORD'):
        raise ImproperlyConfigured(
            'DB_PASSWORD is required in production: the database must use password (scram-sha-256) authentication, not trust.'
        )
    config.update({
        'NAME': environ['DB_NAME'],
        'USER': environ['DB_USER'],
        'PASSWORD': environ.get('DB_PASSWORD', ''),
        'HOST': environ.get('DB_HOST', 'localhost'),
        'PORT': environ.get('DB_PORT', '5432'),
    })
    if environ.get('DB_SSLMODE'):
        # Optional for a self-hosted server on another machine; not used by the same-server setup.
        config['OPTIONS'] = _tls_options(environ, {}, debug=True)
    return config


def describe(config):
    """One safe line about the connection, without the password (for logs and checks)."""
    opts = config.get('OPTIONS', {})
    return (
        f"{config['USER']}@{config['HOST']}:{config['PORT']}/{config['NAME']} "
        f"sslmode={opts.get('sslmode', 'default')} cert={'yes' if opts.get('sslrootcert') else 'no'}"
    )
