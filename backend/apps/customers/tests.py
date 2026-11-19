from decimal import Decimal

from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.test import override_settings
from rest_framework.test import APITestCase

from apps.catalog.models import Category, Product

from .models import Address

User = get_user_model()
PASSWORD = 'Sturdy-Pass-91'


def make_customer(email='ali@example.com', **extra):
    return User.objects.create_user(email.lower(), email=email, password=PASSWORD, first_name='Ali', **extra)


def address_payload(**overrides):
    data = {
        'label': 'Home', 'recipientName': 'Ali Raza', 'phone': '0300-123 4567',
        'line1': 'House 12, Street 4', 'area': 'Gulberg', 'city': 'Lahore',
    }
    data.update(overrides)
    return data


class CustomerTestBase(APITestCase):
    def setUp(self):
        cache.clear()


class RegistrationTests(CustomerTestBase):
    def register(self, **overrides):
        data = {'email': 'Sara@Example.com', 'password': PASSWORD, 'firstName': 'Sara', 'lastName': 'Khan', 'phone': '0301 7654321'}
        data.update(overrides)
        return self.client.post('/api/customer/auth/register/', data, format='json')

    def test_register_creates_a_customer_and_signs_in(self):
        res = self.register()
        self.assertEqual(res.status_code, 201, res.data)
        self.assertIn('access', res.data)
        self.assertEqual(res.data['user']['name'], 'Sara Khan')
        self.assertEqual(res.data['user']['phone'], '03017654321')
        self.assertNotIn('password', res.data['user'])
        user = User.objects.get(email__iexact='sara@example.com')
        self.assertFalse(user.is_staff or user.is_superuser)
        self.assertTrue(user.check_password(PASSWORD))

    def test_cannot_register_as_staff(self):
        res = self.register(is_staff=True, is_superuser=True, isStaff=True)
        self.assertEqual(res.status_code, 201)
        user = User.objects.get(email__iexact='sara@example.com')
        self.assertFalse(user.is_staff)
        self.assertFalse(user.is_superuser)

    def test_rejects_duplicates_weak_passwords_and_bad_phones(self):
        make_customer('sara@example.com', phone='03017654321')
        self.assertIn('email', self.register().data)
        self.assertIn('phone', self.register(email='new@example.com').data)
        self.assertIn('password', self.register(email='x@example.com', phone='', password='123').data)
        self.assertIn('phone', self.register(email='y@example.com', phone='12ab').data)
        self.assertEqual(User.objects.count(), 1)

    def test_registration_is_throttled(self):
        for i in range(20):
            self.register(email=f'u{i}@example.com', phone='')
        self.assertEqual(self.register(email='last@example.com', phone='').status_code, 429)


class RoleSeparationTests(CustomerTestBase):
    @classmethod
    def setUpTestData(cls):
        cls.customer = make_customer()
        cls.staff = User.objects.create_user('owner', email='owner@alzaryab.pk', password=PASSWORD, is_staff=True)

    def login(self, url, email):
        return self.client.post(url, {'email': email, 'password': PASSWORD}, format='json')

    def test_customer_login_and_refresh(self):
        res = self.login('/api/customer/auth/login/', 'ali@example.com')
        self.assertEqual(res.status_code, 200)
        refreshed = self.client.post('/api/customer/auth/refresh/', {'refresh': res.data['refresh']}, format='json')
        self.assertEqual(refreshed.status_code, 200)

    def test_each_app_refuses_the_other_kind_of_account(self):
        self.assertEqual(self.login('/api/customer/auth/login/', 'owner@alzaryab.pk').status_code, 403)
        self.assertEqual(self.login('/api/auth/login/', 'ali@example.com').status_code, 403)

    def test_tokens_only_refresh_at_their_own_endpoint(self):
        customer_refresh = self.login('/api/customer/auth/login/', 'ali@example.com').data['refresh']
        admin_refresh = self.login('/api/auth/login/', 'owner@alzaryab.pk').data['refresh']
        self.assertEqual(self.client.post('/api/auth/refresh/', {'refresh': customer_refresh}, format='json').status_code, 401)
        self.assertEqual(self.client.post('/api/customer/auth/refresh/', {'refresh': admin_refresh}, format='json').status_code, 401)

    def test_customer_cannot_use_admin_api(self):
        self.client.force_authenticate(self.customer)
        for url in ['/api/products/', '/api/categories/', '/api/orders/', '/api/orders/summary/', '/api/auth/me/']:
            with self.subTest(url=url):
                self.assertEqual(self.client.get(url).status_code, 403)

    def test_staff_cannot_use_customer_api(self):
        self.client.force_authenticate(self.staff)
        for url in ['/api/customer/profile/', '/api/customer/addresses/', '/api/customer/orders/']:
            with self.subTest(url=url):
                self.assertEqual(self.client.get(url).status_code, 403)

    def test_anonymous_gets_401(self):
        for url in ['/api/customer/profile/', '/api/customer/addresses/', '/api/customer/orders/']:
            with self.subTest(url=url):
                self.assertEqual(self.client.get(url).status_code, 401)


class ProfileTests(CustomerTestBase):
    def setUp(self):
        super().setUp()
        self.customer = make_customer()
        self.client.force_authenticate(self.customer)

    def test_get_and_update_profile(self):
        self.assertEqual(self.client.get('/api/customer/profile/').data['email'], 'ali@example.com')
        res = self.client.patch(
            '/api/customer/profile/',
            {'firstName': 'Ali', 'lastName': 'Raza', 'phone': '+92 300 1112223', 'email': 'evil@example.com', 'is_staff': True},
            format='json',
        )
        self.assertEqual(res.status_code, 200, res.data)
        self.customer.refresh_from_db()
        self.assertEqual((self.customer.last_name, self.customer.phone), ('Raza', '+923001112223'))
        self.assertEqual(self.customer.email, 'ali@example.com')
        self.assertFalse(self.customer.is_staff)

    def test_phone_already_used_by_someone_else(self):
        make_customer('other@example.com', phone='03009998887')
        res = self.client.patch('/api/customer/profile/', {'phone': '0300 999 8887'}, format='json')
        self.assertEqual(res.status_code, 400)


class AddressTests(CustomerTestBase):
    def setUp(self):
        super().setUp()
        self.customer = make_customer()
        self.client.force_authenticate(self.customer)

    def add(self, **overrides):
        return self.client.post('/api/customer/addresses/', address_payload(**overrides), format='json')

    def test_first_address_is_default_and_default_can_move(self):
        first = self.add().data
        second = self.add(label='Work').data
        self.assertTrue(first['isDefault'])
        self.assertFalse(second['isDefault'])
        self.assertEqual(first['phone'], '03001234567')

        self.client.patch(f"/api/customer/addresses/{second['id']}/", {'isDefault': True}, format='json')
        defaults = list(Address.objects.filter(is_default=True).values_list('id', flat=True))
        self.assertEqual(defaults, [second['id']])

    def test_deleting_the_default_promotes_another(self):
        first = self.add().data
        second = self.add(label='Work').data
        self.assertEqual(self.client.delete(f"/api/customer/addresses/{first['id']}/").status_code, 204)
        self.assertTrue(Address.objects.get(pk=second['id']).is_default)

    def test_validation_and_limit(self):
        res = self.add(phone='abc', city='')
        self.assertEqual(res.status_code, 400)
        self.assertEqual(set(res.data), {'phone', 'city'})
        with override_settings(MAX_ADDRESSES_PER_CUSTOMER=2):
            self.add()
            self.add()
            self.assertEqual(self.add().status_code, 400)

    def test_customers_only_see_their_own_addresses(self):
        mine = self.add().data
        other = make_customer('other@example.com')
        theirs = Address.objects.create(customer=other, recipient_name='X', phone='03000000000', line1='1', area='A', city='C', is_default=True)
        self.assertEqual([a['id'] for a in self.client.get('/api/customer/addresses/').data], [mine['id']])
        for method in ('get', 'patch', 'delete'):
            with self.subTest(method=method):
                res = getattr(self.client, method)(f'/api/customer/addresses/{theirs.id}/', {}, format='json')
                self.assertEqual(res.status_code, 404)
        self.assertTrue(Address.objects.filter(pk=theirs.pk).exists())


class PublicCatalogTests(CustomerTestBase):
    @classmethod
    def setUpTestData(cls):
        dairy = Category.objects.get(name='Dairy & Eggs')
        hidden_category = Category.objects.create(name='Hidden', is_active=False)

        def product(name, **extra):
            defaults = {'category': dairy, 'unit': '1 L', 'price': Decimal('100'), 'stock': 10}
            defaults.update(extra)
            return Product.objects.create(name=name, **defaults)

        cls.visible = product('Milk')
        product('Butter', stock=0)
        product('Removed', is_active=False)
        product('Unavailable', is_available=False)
        product('In hidden category', category=hidden_category)

    def test_only_active_available_products_without_stock_counts(self):
        res = self.client.get('/api/catalog/products/')
        self.assertEqual(res.status_code, 200)
        names = [p['name'] for p in res.data['results']]
        self.assertEqual(names, ['Butter', 'Milk'])
        product = res.data['results'][1]
        self.assertNotIn('stock', product)
        self.assertEqual((product['inStock'], product['stockStatus']), (True, 'in'))
        self.assertFalse(res.data['results'][0]['inStock'])

    def test_detail_search_category_and_read_only(self):
        self.assertEqual(self.client.get(f'/api/catalog/products/{self.visible.id}/').status_code, 200)
        hidden = Product.objects.get(name='Unavailable')
        self.assertEqual(self.client.get(f'/api/catalog/products/{hidden.id}/').status_code, 404)
        self.assertEqual(len(self.client.get('/api/catalog/products/?search=mil').data['results']), 1)
        self.assertEqual(len(self.client.get('/api/catalog/products/?category=Snacks').data['results']), 0)
        self.assertEqual(self.client.post('/api/catalog/products/', {}, format='json').status_code, 405)
        self.assertEqual(self.client.delete(f'/api/catalog/products/{self.visible.id}/').status_code, 405)

    def test_categories_with_products_on_sale(self):
        res = self.client.get('/api/catalog/categories/')
        self.assertEqual([(c['name'], c['productCount']) for c in res.data], [('Dairy & Eggs', 2)])


class PasswordResetTests(CustomerTestBase):
    """Customer password reset with an emailed 6-digit code."""

    NEW = 'Brand-New-Pass-77'

    def setUp(self):
        super().setUp()
        from django.core import mail

        self.mail = mail
        self.customer = make_customer()

    def request_code(self, email='ali@example.com'):
        return self.client.post('/api/customer/auth/password-reset/', {'email': email}, format='json')

    def confirm(self, code, password=None, email='ali@example.com'):
        return self.client.post(
            '/api/customer/auth/password-reset/confirm/', {'email': email, 'code': code, 'password': password or self.NEW}, format='json'
        )

    def sent_code(self):
        import re

        return re.search(r'code is: (\d{6})', self.mail.outbox[-1].body).group(1)

    def login(self, password):
        return self.client.post('/api/customer/auth/login/', {'email': 'ali@example.com', 'password': password}, format='json')

    def test_reset_with_the_emailed_code(self):
        res = self.request_code('ALI@example.com ')
        self.assertEqual(res.status_code, 202)
        self.assertEqual(len(self.mail.outbox), 1)
        message = self.mail.outbox[0]
        self.assertEqual(message.to, ['ali@example.com'])
        self.assertIn('expires', res.data['detail'])
        code = self.sent_code()

        from .models import PasswordResetCode

        stored = PasswordResetCode.objects.get()
        self.assertNotIn(code, stored.code_hash)  # only a hash is kept

        res = self.confirm(code)
        self.assertEqual(res.status_code, 200, res.data)
        self.assertEqual(self.login(PASSWORD).status_code, 401)
        self.assertEqual(self.login(self.NEW).status_code, 200)

    def test_same_answer_for_unknown_staff_and_inactive_accounts(self):
        known = self.request_code().data
        User.objects.create_user('owner', email='owner@alzaryab.pk', password=PASSWORD, is_staff=True)
        make_customer('gone@example.com', is_active=False)
        for email in ('nobody@example.com', 'owner@alzaryab.pk', 'gone@example.com'):
            cache.clear()
            res = self.request_code(email)
            self.assertEqual((res.status_code, res.data), (202, known))
        self.assertEqual(len(self.mail.outbox), 1)  # only the real customer got an email
        self.assertEqual(self.confirm('123456', email='owner@alzaryab.pk').data['code'], 'invalid_code')

    def test_code_works_once(self):
        self.request_code()
        code = self.sent_code()
        self.assertEqual(self.confirm(code).status_code, 200)
        res = self.confirm(code, password='Another-Pass-88')
        self.assertEqual((res.status_code, res.data['code']), (400, 'invalid_code'))

    def test_code_expires(self):
        from datetime import timedelta

        from django.utils import timezone

        from .models import PasswordResetCode

        self.request_code()
        code = self.sent_code()
        PasswordResetCode.objects.update(expires_at=timezone.now() - timedelta(seconds=1))
        self.assertEqual(self.confirm(code).data['code'], 'invalid_code')
        self.assertEqual(self.login(PASSWORD).status_code, 200)

    def test_code_locks_after_five_wrong_tries(self):
        self.request_code()
        code = self.sent_code()
        wrong = '000000' if code != '000000' else '111111'
        for _ in range(5):
            self.assertEqual(self.confirm(wrong).data['code'], 'invalid_code')
        self.assertEqual(self.confirm(code).data['code'], 'invalid_code')  # locked even with the right code
        self.assertEqual(self.login(PASSWORD).status_code, 200)

    def test_new_request_cancels_the_old_code_and_resends_are_limited(self):
        from datetime import timedelta

        from django.utils import timezone

        from .models import PasswordResetCode

        self.request_code()
        first = self.sent_code()
        self.request_code()  # within a minute: no second email
        self.assertEqual(len(self.mail.outbox), 1)
        PasswordResetCode.objects.update(created_at=timezone.now() - timedelta(minutes=2))
        cache.clear()
        self.request_code()
        self.assertEqual(len(self.mail.outbox), 2)
        self.assertEqual(self.confirm(first).data['code'], 'invalid_code')
        self.assertEqual(self.confirm(self.sent_code()).status_code, 200)

    def test_hourly_cap_per_account(self):
        from datetime import timedelta

        from django.utils import timezone

        from .models import PasswordResetCode

        for _ in range(7):
            PasswordResetCode.objects.update(created_at=timezone.now() - timedelta(minutes=5))
            cache.clear()
            self.request_code()
        self.assertEqual(len(self.mail.outbox), 5)

    def test_daily_cap_per_account(self):
        from datetime import timedelta

        from django.utils import timezone

        from .models import PasswordResetCode

        for _ in range(14):
            PasswordResetCode.objects.update(created_at=timezone.now() - timedelta(hours=2))  # outside the hourly window
            cache.clear()
            self.request_code()
        self.assertEqual(len(self.mail.outbox), 10)

    def test_weak_password_is_refused_without_using_the_code(self):
        self.request_code()
        code = self.sent_code()
        res = self.confirm(code, password='12345678')
        self.assertEqual(res.status_code, 400)
        self.assertIn('password', res.data)
        self.assertEqual(self.confirm(code).status_code, 200)

    def test_reset_ends_every_existing_session(self):
        tokens = self.login(PASSWORD).data
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {tokens['access']}")
        self.assertEqual(self.client.get('/api/customer/profile/').status_code, 200)
        self.client.credentials()
        self.request_code()
        self.assertEqual(self.confirm(self.sent_code()).status_code, 200)

        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {tokens['access']}")
        self.assertEqual(self.client.get('/api/customer/profile/').status_code, 401)
        self.client.credentials()
        self.assertEqual(self.client.post('/api/customer/auth/refresh/', {'refresh': tokens['refresh']}, format='json').status_code, 401)

        from rest_framework_simplejwt.token_blacklist.models import OutstandingToken

        self.assertFalse(OutstandingToken.objects.filter(user=self.customer, blacklistedtoken__isnull=True).exists())

    def test_input_validation(self):
        self.assertEqual(self.request_code('not-an-email').status_code, 400)
        res = self.confirm('12ab')
        self.assertEqual(res.status_code, 400)
        self.assertEqual(res.data['code'], ['Enter the 6-digit code from the email.'])

    def test_requests_are_rate_limited_per_ip(self):
        statuses = [self.request_code(f'person{i}@example.com').status_code for i in range(12)]
        self.assertEqual(statuses[:10], [202] * 10)
        self.assertEqual(statuses[10:], [429, 429])

    def test_email_failure_does_not_change_the_answer(self):
        with override_settings(EMAIL_BACKEND='apps.customers.tests.BrokenEmailBackend'):
            res = self.request_code()
        self.assertEqual(res.status_code, 202)


class BrokenEmailBackend:
    def __init__(self, *args, **kwargs):
        pass

    def send_messages(self, messages):
        raise ConnectionRefusedError('SMTP server unavailable')


class PasswordResetDisabledTests(CustomerTestBase):
    """Production default until email delivery works: both endpoints refuse, nothing is sent or stored."""

    def setUp(self):
        super().setUp()
        from django.core import mail

        self.mail = mail
        self.customer = make_customer()

    def request_code(self, email='ali@example.com'):
        return self.client.post('/api/customer/auth/password-reset/', {'email': email}, format='json')

    def confirm(self, code, email='ali@example.com'):
        return self.client.post('/api/customer/auth/password-reset/confirm/', {'email': email, 'code': code, 'password': 'Brand-New-Pass-77'}, format='json')

    def test_disabled_reset_sends_nothing_and_stores_nothing(self):
        from .models import PasswordResetCode

        with override_settings(PASSWORD_RESET_ENABLED=False):
            res = self.request_code()
            self.assertEqual(res.status_code, 503)
            self.assertEqual(res.data['code'], 'password_reset_unavailable')
            self.assertIn('contact the store', res.data['detail'])
            self.assertEqual(len(self.mail.outbox), 0)
            self.assertFalse(PasswordResetCode.objects.exists())
            res = self.confirm('123456')
            self.assertEqual(res.status_code, 503)
        # The password still works: nothing changed.
        self.assertEqual(self.client.post('/api/customer/auth/login/', {'email': 'ali@example.com', 'password': PASSWORD}, format='json').status_code, 200)

    def test_deploy_check_blocks_enabled_reset_without_email(self):
        from apps.core.checks import password_reset_needs_email

        with override_settings(PASSWORD_RESET_ENABLED=False):
            self.assertEqual([m.id for m in password_reset_needs_email(None)], ['alzaryab.W006'])
        with override_settings(PASSWORD_RESET_ENABLED=True, EMAIL_BACKEND='django.core.mail.backends.smtp.EmailBackend', EMAIL_HOST=''):
            self.assertEqual([m.id for m in password_reset_needs_email(None)], ['alzaryab.E002'])
        with override_settings(PASSWORD_RESET_ENABLED=True, EMAIL_BACKEND='django.core.mail.backends.smtp.EmailBackend', EMAIL_HOST='smtp.example.test'):
            self.assertEqual(password_reset_needs_email(None), [])
