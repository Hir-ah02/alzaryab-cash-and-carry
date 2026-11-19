from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.test import TestCase, override_settings
from rest_framework.test import APITestCase


class ProductionUrlTests(TestCase):
    def test_django_admin_site_follows_the_setting(self):
        from django.test import override_settings
        from django.urls import clear_url_caches
        import importlib
        import config.urls

        try:
            with override_settings(DJANGO_ADMIN_PATH=''):
                clear_url_caches()
                importlib.reload(config.urls)
                self.assertEqual(self.client.get('/admin/login/').status_code, 404)
            with override_settings(DJANGO_ADMIN_PATH='manage-x/'):
                clear_url_caches()
                importlib.reload(config.urls)
                self.assertEqual(self.client.get('/manage-x/login/').status_code, 200)
        finally:
            clear_url_caches()
            importlib.reload(config.urls)


NGINX = '127.0.0.1'  # REMOTE_ADDR as gunicorn sees it: the local nginx
REAL_CLIENT = '203.0.113.7'
OTHER_CLIENT = '198.51.100.9'


def proxied(num_proxies):
    """REST_FRAMEWORK as production builds it for the given TRUSTED_PROXY_COUNT."""
    return override_settings(REST_FRAMEWORK={**settings.REST_FRAMEWORK, 'NUM_PROXIES': num_proxies})


class ClientIpRateLimitTests(APITestCase):
    """
    Forged X-Forwarded-For headers must not reset the per-IP limits (login: 10/min).
    nginx (deploy/nginx/alzaryab.conf) overwrites the header with $remote_addr; the tests also cover
    the older $proxy_add_x_forwarded_for style, where the client's own value is kept in front.
    """

    def setUp(self):
        cache.clear()
        get_user_model().objects.create_user('owner', email='owner@example.test', password='Correct-Horse-9', is_staff=True)

    def login(self, xff=None, remote=NGINX, path='/api/auth/login/'):
        extra = {'REMOTE_ADDR': remote}
        if xff is not None:
            extra['HTTP_X_FORWARDED_FOR'] = xff
        return self.client.post(path, {'email': 'owner@example.test', 'password': 'wrong-password'}, format='json', **extra)

    def test_production_setting_is_never_none(self):
        self.assertIsNotNone(settings.REST_FRAMEWORK['NUM_PROXIES'])
        self.assertEqual(settings.REST_FRAMEWORK['NUM_PROXIES'], settings.TRUSTED_PROXY_COUNT)

    def test_spoofed_header_prepended_by_client_is_ignored_behind_nginx(self):
        with proxied(1):
            for i in range(10):
                # Client sends "X-Forwarded-For: 10.0.0.i"; nginx appends the real address.
                self.assertEqual(self.login(xff=f'10.0.0.{i}, {REAL_CLIENT}').status_code, 401)
            self.assertEqual(self.login(xff=f'10.9.9.9, {REAL_CLIENT}').status_code, 429)

    def test_header_overwritten_by_nginx_limits_the_real_client(self):
        with proxied(1):
            for _ in range(10):
                self.assertEqual(self.login(xff=REAL_CLIENT).status_code, 401)
            self.assertEqual(self.login(xff=REAL_CLIENT).status_code, 429)
            # Another visitor behind the same nginx is not affected.
            self.assertEqual(self.login(xff=OTHER_CLIENT).status_code, 401)

    def test_without_proxy_the_header_is_ignored_entirely(self):
        with proxied(0):
            for i in range(10):
                self.assertEqual(self.login(xff=f'10.0.0.{i}', remote=REAL_CLIENT).status_code, 401)
            self.assertEqual(self.login(xff='10.9.9.9', remote=REAL_CLIENT).status_code, 429)

    def test_customer_login_and_password_reset_limits_also_hold(self):
        with proxied(1):
            for i in range(10):
                self.login(xff=f'10.0.1.{i}, {REAL_CLIENT}', path='/api/customer/auth/login/')
            self.assertEqual(self.login(xff=f'10.0.1.99, {REAL_CLIENT}', path='/api/customer/auth/login/').status_code, 429)
            statuses = [
                self.client.post('/api/customer/auth/password-reset/', {'email': f'x{i}@example.test'}, format='json',
                                 REMOTE_ADDR=NGINX, HTTP_X_FORWARDED_FOR=f'10.0.2.{i}, {REAL_CLIENT}').status_code
                for i in range(11)
            ]
            self.assertEqual(statuses[-1], 429)

    def test_the_old_unsafe_setting_would_have_been_bypassed(self):
        """Documents the bug: with NUM_PROXIES=None every forged header was a new client."""
        with proxied(None):
            statuses = [self.login(xff=f'10.0.3.{i}, {REAL_CLIENT}').status_code for i in range(12)]
            self.assertNotIn(429, statuses)


class DeployCheckTests(TestCase):
    def test_none_is_an_error_and_proxy_without_count_warns(self):
        from apps.core.checks import client_ip_detection

        with proxied(None):
            self.assertEqual([m.id for m in client_ip_detection(None)], ['alzaryab.E001'])
        with proxied(0), override_settings(SECURE_PROXY_SSL_HEADER=('HTTP_X_FORWARDED_PROTO', 'https')):
            self.assertEqual([m.id for m in client_ip_detection(None)], ['alzaryab.W005'])
        with proxied(1), override_settings(SECURE_PROXY_SSL_HEADER=('HTTP_X_FORWARDED_PROTO', 'https')):
            self.assertEqual(client_ip_detection(None), [])


class EnvTemplateTests(TestCase):
    def test_placeholders_from_the_template_are_detected(self):
        from config.settings import unfilled_template_values

        environ = {
            'DJANGO_ALLOWED_HOSTS': '<API_DOMAIN>,<SHOP_DOMAIN>',
            'DJANGO_SECRET_KEY': '<generate-on-server>',
            'ORDER_DELIVERY_FEE': '<confirm-with-owner, e.g. 150.00>',
            'DEFAULT_FROM_EMAIL': 'Al Zaryab <no-reply@<STORE_EMAIL_DOMAIN>>',
            'CORS_ALLOWED_ORIGINS': 'https://admin.example.pk',
            'GOOD_FROM': 'Al Zaryab <no-reply@example.pk>',
        }
        self.assertEqual(
            unfilled_template_values(environ),
            ['DEFAULT_FROM_EMAIL', 'DJANGO_ALLOWED_HOSTS', 'DJANGO_SECRET_KEY', 'ORDER_DELIVERY_FEE'],
        )

    def test_the_shipped_template_is_caught_until_filled_in(self):
        from pathlib import Path

        from config.settings import unfilled_template_values

        template = Path(settings.BASE_DIR, 'deploy', 'render', 'render.env.example').read_text()
        environ = dict(
            line.split('=', 1) for line in template.splitlines() if line and not line.startswith('#') and '=' in line
        )
        self.assertEqual(
            unfilled_template_values(environ),
            ['CORS_ALLOWED_ORIGINS', 'DATABASE_URL', 'DJANGO_SECRET_KEY', 'PYTHON_VERSION'],
        )
