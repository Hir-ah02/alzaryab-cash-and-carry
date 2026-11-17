from datetime import timedelta

from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.db import IntegrityError
from rest_framework.test import APITestCase
from rest_framework_simplejwt.tokens import AccessToken, RefreshToken

from .tokens import AccountRefreshToken

User = get_user_model()
PASSWORD = 'Correct-Horse-42'


class AuthTestBase(APITestCase):
    @classmethod
    def setUpTestData(cls):
        cls.staff = User.objects.create_user(
            'owner', email='Owner@Alzaryab.pk', password=PASSWORD, is_staff=True, is_superuser=True,
            first_name='Zaryab', last_name='Khan',
        )
        cls.member = User.objects.create_user('member', email='member@example.com', password=PASSWORD)

    def setUp(self):
        cache.clear()  # reset login throttling between tests

    def login(self, email='owner@alzaryab.pk', password=PASSWORD):
        return self.client.post('/api/auth/login/', {'email': email, 'password': password}, format='json')

    def bearer(self, token):
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {token}')


class LoginTests(AuthTestBase):
    def test_staff_login_returns_tokens_and_safe_user(self):
        res = self.login()
        self.assertEqual(res.status_code, 200, res.data)
        self.assertIn('access', res.data)
        self.assertIn('refresh', res.data)
        self.assertEqual(res.data['user'], {
            'id': self.staff.id, 'username': 'owner', 'email': 'Owner@alzaryab.pk',
            'name': 'Zaryab Khan', 'initials': 'ZK', 'role': 'Owner',
        })
        self.staff.refresh_from_db()
        self.assertIsNotNone(self.staff.last_login)

    def test_email_is_case_insensitive(self):
        self.assertEqual(self.login(email='OWNER@alzaryab.PK').status_code, 200)

    def test_wrong_password_and_unknown_email_get_the_same_401(self):
        wrong = self.login(password='nope')
        unknown = self.login(email='nobody@alzaryab.pk')
        self.assertEqual((wrong.status_code, unknown.status_code), (401, 401))
        self.assertEqual(wrong.data, unknown.data)
        self.assertEqual(wrong.data['detail'], 'Incorrect email or password.')

    def test_non_staff_user_is_refused(self):
        res = self.login(email='member@example.com')
        self.assertEqual(res.status_code, 403)
        self.assertEqual(res.data['code'], 'not_staff')
        self.assertNotIn('access', res.data)

    def test_inactive_user_is_refused_like_bad_credentials(self):
        User.objects.filter(pk=self.staff.pk).update(is_active=False)
        self.assertEqual(self.login().status_code, 401)

    def test_missing_fields_are_400(self):
        res = self.client.post('/api/auth/login/', {}, format='json')
        self.assertEqual(res.status_code, 400)
        self.assertEqual(set(res.data), {'email', 'password'})

    def test_login_is_throttled(self):
        for _ in range(10):
            self.login(password='nope')
        self.assertEqual(self.login().status_code, 429)

    def test_passwords_are_hashed(self):
        self.assertTrue(self.staff.password.startswith(('pbkdf2_', 'argon2', 'bcrypt', 'scrypt', 'md5$')))
        self.assertNotIn(PASSWORD, self.staff.password)

    def test_email_must_be_unique_ignoring_case(self):
        with self.assertRaises(IntegrityError):
            User.objects.create_user('copy', email='OWNER@alzaryab.pk', password=PASSWORD)


class TokenTests(AuthTestBase):
    def test_access_token_authorizes_admin_api(self):
        self.bearer(self.login().data['access'])
        self.assertEqual(self.client.get('/api/auth/me/').data['email'], 'Owner@alzaryab.pk')
        self.assertEqual(self.client.get('/api/products/').status_code, 200)
        res = self.client.post('/api/categories/', {'name': 'Pet Food'}, format='json')
        self.assertEqual(res.status_code, 201)

    def test_no_or_garbage_token_is_401(self):
        self.assertEqual(self.client.get('/api/auth/me/').status_code, 401)
        self.assertEqual(self.client.get('/api/products/').status_code, 401)
        self.bearer('not-a-token')
        self.assertEqual(self.client.get('/api/products/').status_code, 401)

    def test_expired_access_token_is_401(self):
        token = AccessToken.for_user(self.staff)
        token.set_exp(lifetime=-timedelta(seconds=1))
        self.bearer(str(token))
        res = self.client.get('/api/products/')
        self.assertEqual(res.status_code, 401)
        self.assertEqual(res.data['code'], 'token_not_valid')

    def test_refresh_token_cannot_be_used_as_access_token(self):
        self.bearer(self.login().data['refresh'])
        self.assertEqual(self.client.get('/api/products/').status_code, 401)

    def test_refresh_rotates_and_blacklists_old_token(self):
        first = self.login().data['refresh']
        res = self.client.post('/api/auth/refresh/', {'refresh': first}, format='json')
        self.assertEqual(res.status_code, 200)
        self.assertIn('access', res.data)
        self.assertNotEqual(res.data['refresh'], first)

        reuse = self.client.post('/api/auth/refresh/', {'refresh': first}, format='json')
        self.assertEqual(reuse.status_code, 401)
        second = self.client.post('/api/auth/refresh/', {'refresh': res.data['refresh']}, format='json')
        self.assertEqual(second.status_code, 200)

    def test_refresh_refused_once_user_loses_staff_or_is_deleted(self):
        refresh = self.login().data['refresh']
        User.objects.filter(pk=self.staff.pk).update(is_staff=False)
        self.assertEqual(self.client.post('/api/auth/refresh/', {'refresh': refresh}, format='json').status_code, 401)

        temp = User.objects.create_user('temp', email='temp@alzaryab.pk', password=PASSWORD, is_staff=True)
        refresh = str(RefreshToken.for_user(temp))
        temp.delete()
        self.assertEqual(self.client.post('/api/auth/refresh/', {'refresh': refresh}, format='json').status_code, 401)

    def test_expired_refresh_token_is_401(self):
        token = RefreshToken.for_user(self.staff)
        token.set_exp(lifetime=-timedelta(seconds=1))
        res = self.client.post('/api/auth/refresh/', {'refresh': str(token)}, format='json')
        self.assertEqual(res.status_code, 401)

    def test_logout_blacklists_refresh_token(self):
        refresh = self.login().data['refresh']
        self.assertEqual(self.client.post('/api/auth/logout/', {'refresh': refresh}, format='json').status_code, 204)
        self.assertEqual(self.client.post('/api/auth/refresh/', {'refresh': refresh}, format='json').status_code, 401)
        # Logging out twice, or with a bad token, is harmless.
        self.assertEqual(self.client.post('/api/auth/logout/', {'refresh': refresh}, format='json').status_code, 204)
        self.assertEqual(self.client.post('/api/auth/logout/', {'refresh': 'junk'}, format='json').status_code, 204)
        self.assertEqual(self.client.post('/api/auth/logout/', {}, format='json').status_code, 400)

    def test_non_staff_token_cannot_use_admin_endpoints(self):
        # Login refuses non-staff, but a token issued another way must still be useless for writes.
        self.bearer(str(AccountRefreshToken.for_user(self.member).access_token))
        self.assertEqual(self.client.get('/api/auth/me/').status_code, 403)
        self.assertEqual(self.client.post('/api/categories/', {'name': 'X'}, format='json').status_code, 403)


class PasswordBoundTokenTests(APITestCase):
    """Tokens stop working everywhere as soon as the account's password changes."""

    def setUp(self):
        self.staff = User.objects.create_user('owner2', email='owner2@alzaryab.pk', password='Old#Pass-2026', is_staff=True)

    def login(self, password='Old#Pass-2026'):
        return self.client.post('/api/auth/login/', {'email': 'owner2@alzaryab.pk', 'password': password}, format='json')

    def test_password_change_ends_existing_sessions(self):
        tokens = self.login().data
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {tokens['access']}")
        self.assertEqual(self.client.get('/api/auth/me/').status_code, 200)

        self.staff.set_password('New#Pass-2026')
        self.staff.save()

        self.assertEqual(self.client.get('/api/auth/me/').status_code, 401)
        self.client.credentials()
        self.assertEqual(self.client.post('/api/auth/refresh/', {'refresh': tokens['refresh']}, format='json').status_code, 401)
        # Signing in with the new password works as usual.
        fresh = self.login('New#Pass-2026').data
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {fresh['access']}")
        self.assertEqual(self.client.get('/api/auth/me/').status_code, 200)

    def test_refreshed_tokens_keep_the_binding(self):
        tokens = self.login().data
        rotated = self.client.post('/api/auth/refresh/', {'refresh': tokens['refresh']}, format='json').data
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {rotated['access']}")
        self.assertEqual(self.client.get('/api/auth/me/').status_code, 200)
        self.staff.set_password('New#Pass-2026')
        self.staff.save()
        self.assertEqual(self.client.get('/api/auth/me/').status_code, 401)
        self.client.credentials()
        self.assertEqual(self.client.post('/api/auth/refresh/', {'refresh': rotated['refresh']}, format='json').status_code, 401)

    def test_tokens_without_the_binding_are_refused(self):
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {AccessToken.for_user(self.staff)}')
        self.assertEqual(self.client.get('/api/auth/me/').status_code, 401)
        self.client.credentials()
        self.assertEqual(self.client.post('/api/auth/refresh/', {'refresh': str(RefreshToken.for_user(self.staff))}, format='json').status_code, 401)
