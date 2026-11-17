from django.test import TestCase

# Create your tests here.


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
