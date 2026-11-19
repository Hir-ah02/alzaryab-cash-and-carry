"""Hosted-database settings (config/database.py) and Render-specific behaviour."""
import importlib
import os
import tempfile
from unittest import mock

from django.core.exceptions import ImproperlyConfigured
from django.test import SimpleTestCase, TestCase, override_settings

from config.database import build_database_settings, describe, parse_database_url

POOLER = 'postgresql://postgres.abcdefghijkl:s%40fe%2Fp%3Ass@aws-0-ap-northeast-1.pooler.supabase.com:5432/postgres'


class DatabaseUrlTests(SimpleTestCase):
    def setUp(self):
        self.ca = tempfile.NamedTemporaryFile(suffix='.crt')
        self.ca.write(b'-----BEGIN CERTIFICATE-----\n')
        self.ca.flush()

    def tearDown(self):
        self.ca.close()

    def test_local_settings_are_unchanged_without_database_url(self):
        env = {'DB_NAME': 'alzaryab_db', 'DB_USER': 'alzaryab_user', 'DB_PASSWORD': '', 'DB_HOST': 'localhost', 'DB_PORT': '5432'}
        config = build_database_settings(env, debug=True)
        self.assertEqual(
            {k: config[k] for k in ('NAME', 'USER', 'PASSWORD', 'HOST', 'PORT', 'CONN_MAX_AGE')},
            {'NAME': 'alzaryab_db', 'USER': 'alzaryab_user', 'PASSWORD': '', 'HOST': 'localhost', 'PORT': '5432', 'CONN_MAX_AGE': 60},
        )
        self.assertNotIn('OPTIONS', config)

    def test_supabase_pooler_url_is_parsed_with_encoded_password(self):
        fields, options = parse_database_url(POOLER)
        self.assertEqual(fields, {
            'NAME': 'postgres', 'USER': 'postgres.abcdefghijkl', 'PASSWORD': 's@fe/p:ss',
            'HOST': 'aws-0-ap-northeast-1.pooler.supabase.com', 'PORT': '5432',
        })
        self.assertEqual(options, {})

    def test_production_defaults_to_verified_tls(self):
        config = build_database_settings({'DATABASE_URL': POOLER, 'DB_SSLROOTCERT': self.ca.name}, debug=False)
        self.assertEqual(config['OPTIONS']['sslmode'], 'verify-full')
        self.assertEqual(config['OPTIONS']['sslrootcert'], self.ca.name)
        self.assertEqual(config['OPTIONS']['connect_timeout'], '10')
        self.assertEqual(config['HOST'], 'aws-0-ap-northeast-1.pooler.supabase.com')

    def test_production_refuses_unencrypted_or_unverifiable_connections(self):
        for env, message in [
            ({'DATABASE_URL': POOLER}, 'needs DB_SSLROOTCERT'),
            ({'DATABASE_URL': POOLER, 'DB_SSLROOTCERT': '/nonexistent/ca.crt'}, 'file not found'),
            ({'DATABASE_URL': POOLER, 'DB_SSLMODE': 'disable'}, 'must use TLS'),
            ({'DATABASE_URL': POOLER, 'DB_SSLMODE': 'prefer'}, 'must use TLS'),
            ({'DATABASE_URL': POOLER + '?sslmode=disable'}, 'must use TLS'),
            ({'DATABASE_URL': POOLER, 'DB_SSLMODE': 'bogus'}, 'must be one of'),
            ({'DATABASE_URL': POOLER.replace(':s%40fe%2Fp%3Ass', '')}, 'password'),
            ({'DATABASE_URL': 'mysql://u:p@h/db'}, 'postgresql://'),
            ({'DATABASE_URL': POOLER + '?sslmode=require&host=evil'}, 'not supported'),
        ]:
            with self.subTest(env=env), self.assertRaisesMessage(ImproperlyConfigured, message):
                build_database_settings(env, debug=False)

    def test_require_is_allowed_as_encrypted_but_unverified(self):
        config = build_database_settings({'DATABASE_URL': POOLER, 'DB_SSLMODE': 'require'}, debug=False)
        self.assertEqual(config['OPTIONS']['sslmode'], 'require')
        self.assertNotIn('sslrootcert', config['OPTIONS'])

    def test_env_overrides_sslmode_in_url(self):
        config = build_database_settings({'DATABASE_URL': POOLER + '?sslmode=require', 'DB_SSLROOTCERT': self.ca.name, 'DB_SSLMODE': 'verify-full'}, debug=False)
        self.assertEqual(config['OPTIONS']['sslmode'], 'verify-full')

    def test_local_production_still_requires_a_password(self):
        with self.assertRaisesMessage(ImproperlyConfigured, 'DB_PASSWORD is required'):
            build_database_settings({'DB_NAME': 'a', 'DB_USER': 'b'}, debug=False)

    def test_describe_never_shows_the_password(self):
        config = build_database_settings({'DATABASE_URL': POOLER, 'DB_SSLROOTCERT': self.ca.name}, debug=False)
        line = describe(config)
        self.assertNotIn('s@fe', line)
        self.assertIn('postgres.abcdefghijkl@aws-0-ap-northeast-1.pooler.supabase.com:5432/postgres sslmode=verify-full cert=yes', line)


class RenderBehaviourTests(TestCase):
    @override_settings(SECURE_SSL_REDIRECT=True)
    def test_health_check_is_not_redirected_but_everything_else_is(self):
        self.assertEqual(self.client.get('/api/health/').status_code, 200)
        self.assertEqual(self.client.get('/api/catalog/categories/').status_code, 301)

    def test_gunicorn_binds_to_renders_port(self):
        def load(env):
            with mock.patch.dict(os.environ, env, clear=False):
                for k in ('PORT', 'GUNICORN_BIND', 'FORWARDED_ALLOW_IPS'):
                    if k not in env:
                        os.environ.pop(k, None)
                spec = importlib.util.spec_from_file_location('gunicorn_conf', 'deploy/gunicorn.conf.py')
                module = importlib.util.module_from_spec(spec)
                spec.loader.exec_module(module)
                return module

        self.assertEqual(load({}).bind, '127.0.0.1:8000')
        self.assertEqual(load({}).forwarded_allow_ips, '127.0.0.1')
        render = load({'PORT': '10000', 'FORWARDED_ALLOW_IPS': '*'})
        self.assertEqual((render.bind, render.forwarded_allow_ips), ('0.0.0.0:10000', '*'))

    def test_client_ip_diagnostic_is_off_by_default_and_logs_when_on(self):
        with self.assertNoLogs('alzaryab.client_ip'):
            self.client.get('/api/health/')
        from django.conf import settings
        with override_settings(LOG_CLIENT_IP_HEADERS=True, REST_FRAMEWORK={**settings.REST_FRAMEWORK, 'NUM_PROXIES': 1}):
            with self.assertLogs('alzaryab.client_ip', 'WARNING') as logs:
                self.client.get('/api/health/', REMOTE_ADDR='10.1.2.3', HTTP_X_FORWARDED_FOR='6.6.6.6, 203.0.113.7')
        self.assertIn("X-Forwarded-For='6.6.6.6, 203.0.113.7' NUM_PROXIES=1 → rate-limit key 203.0.113.7", logs.output[0])
