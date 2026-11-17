import io
import shutil
from decimal import Decimal

from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import override_settings
from PIL import Image
from rest_framework import status
from rest_framework.test import APITestCase

from apps.inventory.models import StockMovement

from .models import Category, Product

User = get_user_model()


def image_file(name='photo.png', image_format='PNG', size=(20, 20)):
    buffer = io.BytesIO()
    Image.new('RGB', size, 'red').save(buffer, image_format)
    content_type = {'PNG': 'image/png', 'JPEG': 'image/jpeg', 'WEBP': 'image/webp', 'GIF': 'image/gif'}[image_format]
    return SimpleUploadedFile(name, buffer.getvalue(), content_type=content_type)


class APITestBase(APITestCase):
    @classmethod
    def setUpTestData(cls):
        cls.staff = User.objects.create_user('owner', password='pass-12345', is_staff=True)
        cls.member = User.objects.create_user('member', password='pass-12345')
        # Seeded by migration 0002.
        cls.dairy = Category.objects.get(name='Dairy & Eggs')
        cls.snacks = Category.objects.get(name='Snacks')

    @classmethod
    def tearDownClass(cls):
        super().tearDownClass()
        shutil.rmtree(settings.MEDIA_ROOT, ignore_errors=True)

    def setUp(self):
        self.client.force_authenticate(self.staff)

    def make_product(self, name='Milk', stock=10, category=None, **extra):
        return Product.objects.create(
            name=name, category=category or self.dairy, unit='1 L', price=Decimal('320'), stock=stock, **extra
        )

    def payload(self, **overrides):
        data = {'name': 'Olpers Milk', 'category': 'Dairy & Eggs', 'unit': '1 L', 'price': '320', 'stock': 12}
        data.update(overrides)
        return data


class SeedCategoriesTests(APITestBase):
    def test_portal_categories_are_seeded(self):
        self.assertEqual(Category.objects.count(), 12)


class ProductCrudTests(APITestBase):
    def test_create_returns_portal_shape_and_logs_initial_stock(self):
        res = self.client.post('/api/products/', self.payload(), format='json')
        self.assertEqual(res.status_code, status.HTTP_201_CREATED, res.data)
        self.assertEqual(res.data['category'], 'Dairy & Eggs')
        self.assertEqual(res.data['price'], '320.00')
        self.assertEqual(res.data['stockStatus'], 'in')
        self.assertTrue(res.data['active'])
        self.assertTrue(res.data['isAvailable'])
        for key in ('id', 'createdAt', 'updatedAt', 'image', 'categoryId'):
            self.assertIn(key, res.data)

        movement = StockMovement.objects.get(product_id=res.data['id'])
        self.assertEqual((movement.change, movement.quantity_after, movement.reason), (12, 12, 'initial'))
        self.assertEqual(movement.created_by, self.staff)

    def test_create_with_zero_stock_logs_nothing(self):
        res = self.client.post('/api/products/', self.payload(stock=0), format='json')
        self.assertEqual(res.status_code, 201)
        self.assertFalse(StockMovement.objects.exists())

    def test_retrieve(self):
        product = self.make_product()
        res = self.client.get(f'/api/products/{product.id}/')
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data['name'], 'Milk')

    def test_retrieve_missing_is_404(self):
        self.assertEqual(self.client.get('/api/products/999999/').status_code, 404)

    def test_put_update_logs_stock_adjustment(self):
        product = self.make_product(stock=10)
        res = self.client.put(
            f'/api/products/{product.id}/', self.payload(name='Milk', price='350.50', stock=3), format='json'
        )
        self.assertEqual(res.status_code, 200, res.data)
        product.refresh_from_db()
        self.assertEqual((product.price, product.stock), (Decimal('350.50'), 3))
        self.assertEqual(res.data['stockStatus'], 'low')
        movement = product.stock_movements.get()
        self.assertEqual((movement.change, movement.quantity_after, movement.reason), (-7, 3, 'adjustment'))

    def test_patch_without_stock_change_logs_nothing(self):
        product = self.make_product()
        res = self.client.patch(f'/api/products/{product.id}/', {'isAvailable': False}, format='json')
        self.assertEqual(res.status_code, 200)
        self.assertFalse(res.data['isAvailable'])
        self.assertFalse(StockMovement.objects.exists())

    def test_soft_delete_hides_product_but_keeps_row(self):
        product = self.make_product()
        res = self.client.delete(f'/api/products/{product.id}/')
        self.assertEqual(res.status_code, 204)
        product.refresh_from_db()
        self.assertFalse(product.is_active)
        self.assertEqual(self.client.get(f'/api/products/{product.id}/').status_code, 404)
        self.assertEqual(self.client.delete(f'/api/products/{product.id}/').status_code, 404)
        self.assertEqual(self.client.get('/api/products/').data['count'], 0)

    def test_removed_product_name_can_be_reused(self):
        self.make_product(name='Milk', is_active=False)
        res = self.client.post('/api/products/', self.payload(name='Milk'), format='json')
        self.assertEqual(res.status_code, 201, res.data)


class ProductValidationTests(APITestBase):
    def assertInvalid(self, overrides, field):
        res = self.client.post('/api/products/', self.payload(**overrides), format='json')
        self.assertEqual(res.status_code, 400, res.data)
        self.assertIn(field, res.data)
        return res

    def test_rejects_invalid_fields(self):
        self.assertInvalid({'name': ''}, 'name')
        self.assertInvalid({'name': 'x' * 81}, 'name')
        self.assertInvalid({'unit': ''}, 'unit')
        self.assertInvalid({'price': '0'}, 'price')
        self.assertInvalid({'price': '-5'}, 'price')
        self.assertInvalid({'price': '12.345'}, 'price')
        self.assertInvalid({'price': 'abc'}, 'price')
        self.assertInvalid({'stock': -1}, 'stock')
        self.assertInvalid({'stock': '2.5'}, 'stock')
        self.assertInvalid({'category': 'Electronics'}, 'category')
        self.assertFalse(Product.objects.exists())

    def test_rejects_missing_required_fields(self):
        res = self.client.post('/api/products/', {}, format='json')
        self.assertEqual(res.status_code, 400)
        self.assertEqual(set(res.data), {'name', 'category', 'unit', 'price'})

    def test_rejects_inactive_category(self):
        Category.objects.filter(pk=self.snacks.pk).update(is_active=False)
        self.assertInvalid({'category': 'Snacks'}, 'category')

    def test_rejects_duplicate_name_and_unit_case_insensitive(self):
        self.make_product(name='Milk')
        res = self.assertInvalid({'name': 'MILK'}, 'name')
        self.assertIn('already exists', str(res.data['name']))

    def test_same_name_with_different_unit_is_allowed(self):
        self.make_product(name='Milk')
        res = self.client.post('/api/products/', self.payload(name='Milk', unit='500 ml'), format='json')
        self.assertEqual(res.status_code, 201)

    def test_read_only_fields_are_ignored(self):
        res = self.client.post(
            '/api/products/', self.payload(active=False, stockStatus='out', id=777), format='json'
        )
        self.assertEqual(res.status_code, 201)
        self.assertTrue(res.data['active'])
        self.assertNotEqual(res.data['id'], 777)

    def test_invalid_stock_filter_is_400(self):
        res = self.client.get('/api/products/?stock=plenty')
        self.assertEqual(res.status_code, 400)
        self.assertIn('stock', res.data)


class ProductListTests(APITestBase):
    def setUp(self):
        super().setUp()
        self.make_product('Olpers Milk', stock=4)
        self.make_product('Cheddar Cheese', stock=0)
        self.make_product('Farm Eggs', stock=30)
        self.make_product('Lays Chips', stock=5, category=self.snacks)
        self.make_product('Kurkure', stock=6, category=self.snacks)
        self.make_product('Old Item', stock=1, is_active=False)

    def names(self, url):
        res = self.client.get(url)
        self.assertEqual(res.status_code, 200, res.data)
        return sorted(p['name'] for p in res.data['results'])

    def test_list_excludes_removed_products(self):
        self.assertEqual(len(self.names('/api/products/')), 5)

    def test_search_is_case_insensitive(self):
        self.assertEqual(self.names('/api/products/?search=MILK'), ['Olpers Milk'])

    def test_filter_by_category(self):
        self.assertEqual(self.names('/api/products/?category=Snacks'), ['Kurkure', 'Lays Chips'])

    def test_filter_by_stock_status_boundaries(self):
        self.assertEqual(self.names('/api/products/?stock=out'), ['Cheddar Cheese'])
        self.assertEqual(self.names('/api/products/?stock=low'), ['Lays Chips', 'Olpers Milk'])
        self.assertEqual(self.names('/api/products/?stock=in'), ['Farm Eggs', 'Kurkure'])

    def test_filters_combine(self):
        self.assertEqual(self.names('/api/products/?category=Snacks&stock=low&search=lay'), ['Lays Chips'])

    def test_newest_first(self):
        res = self.client.get('/api/products/')
        self.assertEqual(res.data['results'][0]['name'], 'Kurkure')

    def test_pagination(self):
        for i in range(12):
            self.make_product(f'Extra {i}')
        res = self.client.get('/api/products/')
        self.assertEqual((res.data['count'], len(res.data['results'])), (17, 10))
        self.assertIsNotNone(res.data['next'])
        res = self.client.get('/api/products/?page=2')
        self.assertEqual(len(res.data['results']), 7)
        res = self.client.get('/api/products/?page_size=5')
        self.assertEqual(len(res.data['results']), 5)
        self.assertEqual(self.client.get('/api/products/?page=99').status_code, 404)

    def test_active_filter_shows_removed_products_on_request(self):
        self.assertEqual(len(self.names('/api/products/?active=true')), 5)
        self.assertEqual(self.names('/api/products/?active=false'), ['Old Item'])
        self.assertEqual(len(self.names('/api/products/?active=all')), 6)
        self.assertEqual(len(self.names('/api/products/?active=ALL')), 6)

    def test_removed_products_are_labelled_inactive(self):
        res = self.client.get('/api/products/?active=all')
        flags = {p['name']: p['active'] for p in res.data['results']}
        self.assertIs(flags['Old Item'], False)
        self.assertIs(flags['Olpers Milk'], True)

    def test_active_filter_combines_with_other_filters(self):
        self.assertEqual(self.names('/api/products/?active=all&stock=low'), ['Lays Chips', 'Old Item', 'Olpers Milk'])
        self.assertEqual(self.names('/api/products/?active=false&search=old&category=Dairy%20%26%20Eggs'), ['Old Item'])

    def test_invalid_active_filter_is_rejected(self):
        res = self.client.get('/api/products/?active=maybe')
        self.assertEqual(res.status_code, 400)
        self.assertIn('active', res.data)

    def test_removed_products_stay_out_of_single_product_actions(self):
        old = Product.objects.get(name='Old Item')
        self.assertEqual(self.client.get(f'/api/products/{old.id}/').status_code, 404)
        self.assertEqual(self.client.patch(f'/api/products/{old.id}/', {'stock': 3}, format='json').status_code, 404)

    def test_inactive_listing_is_staff_only(self):
        self.client.force_authenticate(None)
        self.assertEqual(self.client.get('/api/products/?active=all').status_code, 401)
        customer = get_user_model().objects.create_user('shopper', email='shopper@example.com', password='x')
        self.client.force_authenticate(customer)
        self.assertEqual(self.client.get('/api/products/?active=all').status_code, 403)

    def test_customer_catalogue_never_shows_removed_products(self):
        self.client.force_authenticate(None)
        names = [p['name'] for p in self.client.get('/api/catalog/products/?page_size=100').data['results']]
        self.assertNotIn('Old Item', names)
        old = Product.objects.get(name='Old Item')
        self.assertEqual(self.client.get(f'/api/catalog/products/{old.id}/').status_code, 404)
        self.assertEqual(self.client.get('/api/catalog/products/?search=old').data['count'], 0)

    def test_summary_counts_active_products_only(self):
        res = self.client.get('/api/products/summary/')
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data, {'total': 5, 'inStock': 2, 'lowStock': 2, 'outOfStock': 1})

    def test_stock_movements_endpoint(self):
        product = Product.objects.get(name='Farm Eggs')
        self.client.patch(f'/api/products/{product.id}/', {'stock': 25}, format='json')
        res = self.client.get(f'/api/products/{product.id}/stock-movements/')
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data['results'][0]['change'], -5)
        self.assertEqual(res.data['results'][0]['createdBy'], 'owner')


class ProductImageTests(APITestBase):
    def create_with(self, upload):
        data = self.payload()
        data['image'] = upload
        return self.client.post('/api/products/', data, format='multipart')

    def test_upload_stores_file_path_not_base64(self):
        res = self.create_with(image_file('milk.png'))
        self.assertEqual(res.status_code, 201, res.data)
        product = Product.objects.get(pk=res.data['id'])
        self.assertRegex(product.image.name, r'^products/[0-9a-f]{32}\.png$')
        self.assertTrue(product.image.storage.exists(product.image.name))
        self.assertTrue(res.data['image'].startswith('http://testserver/media/products/'))

    def test_accepts_jpeg_and_webp(self):
        self.assertEqual(self.create_with(image_file('a.jpg', 'JPEG')).status_code, 201)
        self.assertEqual(
            self.client.post(
                '/api/products/', {**self.payload(name='Other'), 'image': image_file('b.webp', 'WEBP')}, format='multipart'
            ).status_code,
            201,
        )

    def test_rejects_unsupported_format(self):
        res = self.create_with(image_file('anim.gif', 'GIF'))
        self.assertEqual(res.status_code, 400)
        self.assertIn('image', res.data)

    def test_rejects_non_image_disguised_as_png(self):
        fake = SimpleUploadedFile('evil.png', b'<script>alert(1)</script>', content_type='image/png')
        res = self.create_with(fake)
        self.assertEqual(res.status_code, 400)
        self.assertIn('image', res.data)

    def test_rejects_mismatched_extension(self):
        res = self.create_with(image_file('photo.jpg', 'PNG'))
        self.assertEqual(res.status_code, 400)

    @override_settings(PRODUCT_IMAGE_MAX_BYTES=100)
    def test_rejects_oversized_file(self):
        res = self.create_with(image_file('big.png', size=(200, 200)))
        self.assertEqual(res.status_code, 400)
        self.assertIn('larger than', str(res.data['image']))

    def test_replacing_and_removing_image_deletes_old_file(self):
        res = self.create_with(image_file('first.png'))
        product = Product.objects.get(pk=res.data['id'])
        first = product.image.name
        storage = product.image.storage

        with self.captureOnCommitCallbacks(execute=True):
            res = self.client.patch(
                f'/api/products/{product.id}/', {'image': image_file('second.png')}, format='multipart'
            )
        self.assertEqual(res.status_code, 200, res.data)
        product.refresh_from_db()
        second = product.image.name
        self.assertNotEqual(first, second)
        self.assertFalse(storage.exists(first))

        with self.captureOnCommitCallbacks(execute=True):
            res = self.client.patch(f'/api/products/{product.id}/', {'image': None}, format='json')
        self.assertEqual(res.status_code, 200, res.data)
        self.assertIsNone(res.data['image'])
        self.assertFalse(storage.exists(second))


class CategoryTests(APITestBase):
    def test_list_returns_active_categories_unpaginated(self):
        Category.objects.filter(pk=self.snacks.pk).update(is_active=False)
        res = self.client.get('/api/categories/')
        self.assertEqual(res.status_code, 200)
        self.assertEqual(len(res.data), 11)
        self.assertEqual(len(self.client.get('/api/categories/?include_inactive=true').data), 12)

    def test_create_and_update(self):
        res = self.client.post('/api/categories/', {'name': 'Pet Food'}, format='json')
        self.assertEqual(res.status_code, 201, res.data)
        self.assertEqual(res.data['productCount'], 0)
        res = self.client.patch(f"/api/categories/{res.data['id']}/", {'name': 'Pet Supplies'}, format='json')
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data['name'], 'Pet Supplies')

    def test_rejects_duplicate_and_blank_names(self):
        self.assertEqual(self.client.post('/api/categories/', {'name': 'snacks'}, format='json').status_code, 400)
        self.assertEqual(self.client.post('/api/categories/', {'name': ''}, format='json').status_code, 400)

    def test_deactivate_and_reactivate(self):
        res = self.client.delete(f'/api/categories/{self.snacks.id}/')
        self.assertEqual(res.status_code, 204)
        self.snacks.refresh_from_db()
        self.assertFalse(self.snacks.is_active)
        res = self.client.patch(f'/api/categories/{self.snacks.id}/', {'active': True}, format='json')
        self.assertEqual(res.status_code, 200)
        self.assertTrue(res.data['active'])

    def test_cannot_deactivate_category_with_active_products(self):
        self.make_product(category=self.snacks)
        res = self.client.delete(f'/api/categories/{self.snacks.id}/')
        self.assertEqual(res.status_code, 400)
        self.assertIn('active product', str(res.data))
        res = self.client.patch(f'/api/categories/{self.snacks.id}/', {'active': False}, format='json')
        self.assertEqual(res.status_code, 400)
        self.snacks.refresh_from_db()
        self.assertTrue(self.snacks.is_active)


class PermissionTests(APITestBase):
    def setUp(self):
        self.product = self.make_product()

    def test_anonymous_requests_are_rejected(self):
        self.client.force_authenticate(None)
        for method, url in [
            ('get', '/api/products/'),
            ('get', '/api/products/summary/'),
            ('get', '/api/categories/'),
            ('post', '/api/products/'),
            ('put', f'/api/products/{self.product.id}/'),
            ('patch', f'/api/products/{self.product.id}/'),
            ('delete', f'/api/products/{self.product.id}/'),
            ('post', '/api/categories/'),
            ('delete', f'/api/categories/{self.dairy.id}/'),
        ]:
            with self.subTest(method=method, url=url):
                res = getattr(self.client, method)(url, {}, format='json')
                self.assertIn(res.status_code, (401, 403))

    def test_non_staff_can_neither_read_nor_write_admin_api(self):
        # Customers sign in too (Task 4), so the admin product API is staff-only; they use /api/catalog/.
        self.client.force_authenticate(self.member)
        self.assertEqual(self.client.get('/api/products/').status_code, 403)
        self.assertEqual(self.client.get('/api/products/summary/').status_code, 403)
        self.assertEqual(self.client.get('/api/categories/').status_code, 403)
        self.assertEqual(self.client.post('/api/products/', self.payload(), format='json').status_code, 403)
        self.assertEqual(
            self.client.patch(f'/api/products/{self.product.id}/', {'stock': 1}, format='json').status_code, 403
        )
        self.assertEqual(self.client.delete(f'/api/products/{self.product.id}/').status_code, 403)
        self.assertEqual(self.client.post('/api/categories/', {'name': 'X'}, format='json').status_code, 403)
        self.product.refresh_from_db()
        self.assertTrue(self.product.is_active)
        self.assertEqual(self.product.stock, 10)

    def test_health_check_stays_public(self):
        self.client.force_authenticate(None)
        self.assertEqual(self.client.get('/api/health/').status_code, 200)


class FrontendContractTests(APITestBase):
    """Response shapes that src/services/productService.js and categoryService.js rely on."""

    PRODUCT_KEYS = {
        'id', 'name', 'category', 'categoryId', 'description', 'unit', 'price', 'stock',
        'stockStatus', 'image', 'isAvailable', 'active', 'createdAt', 'updatedAt',
    }

    def test_product_list_and_detail_shape(self):
        product = self.make_product()
        res = self.client.get('/api/products/?page_size=10')
        self.assertEqual(set(res.data), {'count', 'next', 'previous', 'results'})
        self.assertEqual(set(res.data['results'][0]), self.PRODUCT_KEYS)
        detail = self.client.get(f'/api/products/{product.id}/').data
        self.assertEqual(set(detail), self.PRODUCT_KEYS)
        self.assertIsInstance(detail['id'], int)
        self.assertEqual(detail['price'], '320.00')  # decimal string; the frontend converts it
        self.assertIsNone(detail['image'])

    def test_summary_shape(self):
        self.assertEqual(set(self.client.get('/api/products/summary/').data), {'total', 'inStock', 'lowStock', 'outOfStock'})

    def test_category_list_shape(self):
        res = self.client.get('/api/categories/')
        self.assertIsInstance(res.data, list)
        self.assertEqual(
            set(res.data[0]), {'id', 'name', 'description', 'active', 'productCount', 'createdAt', 'updatedAt'}
        )

    def test_details_only_edit_keeps_the_image(self):
        res = self.client.post('/api/products/', {**self.payload(), 'image': image_file('keep.png')}, format='multipart')
        image_url = res.data['image']
        res = self.client.patch(f"/api/products/{res.data['id']}/", self.payload(price='999'), format='json')
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data['image'], image_url)
        self.assertEqual(res.data['price'], '999.00')


class DescriptionAndAvailabilityTests(APITestBase):
    def test_description_is_saved_and_limited(self):
        res = self.client.post('/api/products/', self.payload(description='Fresh full-cream milk.'), format='json')
        self.assertEqual(res.status_code, 201)
        self.assertEqual(res.data['description'], 'Fresh full-cream milk.')
        res = self.client.post('/api/products/', self.payload(name='Other', description='x' * 1001), format='json')
        self.assertEqual(res.status_code, 400)
        self.assertIn('description', res.data)

    def test_hiding_a_product_removes_it_from_the_store_only(self):
        product = self.make_product()
        res = self.client.patch(f'/api/products/{product.id}/', {'isAvailable': False}, format='json')
        self.assertEqual(res.status_code, 200)
        self.assertEqual(self.client.get('/api/products/').data['count'], 1)  # still in admin inventory
        self.client.force_authenticate(None)
        self.assertEqual(self.client.get('/api/catalog/products/').data['count'], 0)
        self.assertEqual(self.client.get(f'/api/catalog/products/{product.id}/').status_code, 404)


class CategoryOrderingTests(APITestBase):
    def test_categories_are_listed_alphabetically(self):
        Category.objects.create(name='Aardvark Treats')
        names = [c['name'] for c in self.client.get('/api/categories/?include_inactive=true').data]
        self.assertEqual(names, sorted(names))
        self.assertEqual(names[0], 'Aardvark Treats')
