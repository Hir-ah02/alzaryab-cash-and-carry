import threading
import unittest
import uuid
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.db import connection
from django.test import TransactionTestCase, override_settings
from rest_framework.test import APITestCase

from apps.catalog.models import Category, Product
from apps.customers.models import Address
from apps.inventory.models import StockMovement

from .models import Order, OrderStatus
from .services import place_order

User = get_user_model()


class OrderTestBase(APITestCase):
    @classmethod
    def setUpTestData(cls):
        cls.customer = User.objects.create_user('ali@example.com', email='ali@example.com', password='x', first_name='Ali')
        cls.other = User.objects.create_user('sara@example.com', email='sara@example.com', password='x', first_name='Sara')
        cls.staff = User.objects.create_user('owner', email='owner@alzaryab.pk', password='x', is_staff=True, first_name='Zaryab')
        cls.address = Address.objects.create(
            customer=cls.customer, recipient_name='Ali Raza', phone='03001234567', line1='House 12',
            area='Gulberg', city='Lahore', instructions='Ring twice', is_default=True,
        )
        cls.other_address = Address.objects.create(
            customer=cls.other, recipient_name='Sara', phone='03007654321', line1='Flat 3', area='DHA', city='Lahore',
            is_default=True,
        )
        dairy = Category.objects.get(name='Dairy & Eggs')
        cls.milk = Product.objects.create(name='Milk', category=dairy, unit='1 L', price=Decimal('320.00'), stock=10)
        cls.eggs = Product.objects.create(name='Eggs', category=dairy, unit='1 dozen', price=Decimal('390.50'), stock=3)

    def setUp(self):
        self.client.force_authenticate(self.customer)

    def order_payload(self, items=None, **overrides):
        data = {
            'items': items or [{'productId': self.milk.id, 'quantity': 2}, {'productId': self.eggs.id, 'quantity': 1}],
            'addressId': self.address.id,
        }
        data.update(overrides)
        return data

    def place(self, **kwargs):
        return self.client.post('/api/customer/orders/', self.order_payload(**kwargs), format='json')

    def stock(self, product):
        return Product.objects.get(pk=product.pk).stock


@override_settings(ORDER_DELIVERY_FEE=Decimal('150.00'), ORDER_FREE_DELIVERY_FROM=None)
class PlaceOrderTests(OrderTestBase):
    def test_places_order_with_server_prices_and_deducts_stock(self):
        res = self.place(subtotal='1.00', total='1.00', items=[
            {'productId': self.milk.id, 'quantity': 2, 'unitPrice': '1.00'},
            {'productId': self.eggs.id, 'quantity': 1},
        ])
        self.assertEqual(res.status_code, 201, res.data)
        self.assertRegex(res.data['reference'], r'^AZ-[2-9A-HJ-NP-Z]{8}$')
        self.assertEqual((res.data['subtotal'], res.data['deliveryFee'], res.data['total']), ('1030.50', '150.00', '1180.50'))
        self.assertEqual(res.data['status'], 'pending')
        self.assertEqual(res.data['paymentMethod'], 'cash_on_delivery')
        self.assertEqual(res.data['paymentStatus'], 'unpaid')
        self.assertEqual([(i['productName'], i['unitPrice'], i['quantity'], i['lineTotal']) for i in res.data['items']],
                         [('Milk', '320.00', 2, '640.00'), ('Eggs', '390.50', 1, '390.50')])
        self.assertEqual(res.data['delivery']['instructions'], 'Ring twice')
        self.assertEqual(res.data['history'][0]['toStatus'], 'pending')

        self.assertEqual((self.stock(self.milk), self.stock(self.eggs)), (8, 2))
        movements = StockMovement.objects.filter(order_id=res.data['id']).order_by('product_id')
        self.assertEqual([(m.change, m.reason) for m in movements], [(-2, 'order'), (-1, 'order')])

    @override_settings(ORDER_FREE_DELIVERY_FROM=Decimal('1000.00'))
    def test_free_delivery_threshold(self):
        res = self.place()
        self.assertEqual((res.data['deliveryFee'], res.data['total']), ('0.00', '1030.50'))

    def test_order_keeps_snapshots_when_product_and_address_change(self):
        order_id = self.place().data['id']
        Product.objects.filter(pk=self.milk.pk).update(name='Renamed', price=Decimal('999'))
        Address.objects.filter(pk=self.address.pk).update(line1='Moved away')
        detail = self.client.get(f'/api/customer/orders/{order_id}/').data
        self.assertEqual(detail['items'][0]['productName'], 'Milk')
        self.assertEqual(detail['items'][0]['unitPrice'], '320.00')
        self.assertEqual(detail['delivery']['line1'], 'House 12')

    def test_repeated_lines_are_merged(self):
        res = self.place(items=[{'productId': self.milk.id, 'quantity': 1}, {'productId': self.milk.id, 'quantity': 2}])
        self.assertEqual(res.status_code, 201)
        self.assertEqual([(i['productName'], i['quantity']) for i in res.data['items']], [('Milk', 3)])
        self.assertEqual(self.stock(self.milk), 7)

    def test_insufficient_stock_changes_nothing(self):
        res = self.place(items=[{'productId': self.milk.id, 'quantity': 2}, {'productId': self.eggs.id, 'quantity': 4}])
        self.assertEqual(res.status_code, 400)
        self.assertEqual(res.data['items'], [{'productId': self.eggs.id, 'message': 'Only 3 left in stock.', 'available': 3}])
        self.assertEqual((self.stock(self.milk), self.stock(self.eggs)), (10, 3))
        self.assertFalse(Order.objects.exists())
        self.assertFalse(StockMovement.objects.exists())

    def test_unavailable_removed_and_unknown_products_are_refused(self):
        Product.objects.filter(pk=self.milk.pk).update(is_available=False)
        Product.objects.filter(pk=self.eggs.pk).update(is_active=False)
        res = self.place(items=[
            {'productId': self.milk.id, 'quantity': 1}, {'productId': self.eggs.id, 'quantity': 1},
            {'productId': 999999, 'quantity': 1},
        ])
        self.assertEqual(res.status_code, 400)
        self.assertEqual(len(res.data['items']), 3)
        self.assertFalse(Order.objects.exists())

    def test_out_of_stock(self):
        Product.objects.filter(pk=self.eggs.pk).update(stock=0)
        res = self.place(items=[{'productId': self.eggs.id, 'quantity': 1}])
        self.assertEqual(res.data['items'][0]['message'], 'This product is out of stock.')

    def test_same_request_id_never_creates_two_orders(self):
        request_id = str(uuid.uuid4())
        first = self.place(requestId=request_id)
        second = self.place(requestId=request_id)
        self.assertEqual((first.status_code, second.status_code), (201, 200))
        self.assertEqual(first.data['id'], second.data['id'])
        self.assertEqual(Order.objects.count(), 1)
        self.assertEqual(self.stock(self.milk), 8)
        # A new request id is a new order.
        self.assertEqual(self.place(requestId=str(uuid.uuid4())).status_code, 201)

    def test_invalid_requests(self):
        cases = [
            ({'items': []}, 'items'),
            ({'items': [{'productId': self.milk.id, 'quantity': 0}]}, 'items'),
            ({'items': [{'productId': self.milk.id, 'quantity': 101}]}, 'items'),
            ({'items': [{'productId': self.milk.id}]}, 'items'),
            ({'paymentMethod': 'card'}, 'paymentMethod'),
            ({'addressId': None}, 'addressId'),
            ({'addressId': self.other_address.id}, 'addressId'),  # someone else's address
            ({'requestId': 'not-a-uuid'}, 'requestId'),
        ]
        for overrides, field in cases:
            with self.subTest(overrides=overrides):
                res = self.client.post('/api/customer/orders/', {**self.order_payload(), **overrides}, format='json')
                self.assertEqual(res.status_code, 400, res.data)
                self.assertIn(field, res.data)
        self.assertFalse(Order.objects.exists())
        self.assertEqual(self.stock(self.milk), 10)

    def test_database_rejects_inconsistent_totals(self):
        from django.db import IntegrityError, transaction
        order_id = self.place().data['id']
        with self.assertRaises(IntegrityError), transaction.atomic():
            Order.objects.filter(pk=order_id).update(total=Decimal('1.00'))


class CustomerOrderAccessTests(OrderTestBase):
    def test_history_and_details_only_show_own_orders(self):
        mine = self.place().data['id']
        self.client.force_authenticate(self.other)
        theirs = self.client.post('/api/customer/orders/', {
            'items': [{'productId': self.milk.id, 'quantity': 1}], 'addressId': self.other_address.id,
        }, format='json').data['id']

        self.assertEqual([o['id'] for o in self.client.get('/api/customer/orders/').data['results']], [theirs])
        self.assertEqual(self.client.get(f'/api/customer/orders/{mine}/').status_code, 404)
        self.assertEqual(self.client.post(f'/api/customer/orders/{mine}/cancel/').status_code, 404)

        self.client.force_authenticate(self.customer)
        listed = self.client.get('/api/customer/orders/').data['results']
        self.assertEqual([o['id'] for o in listed], [mine])
        self.assertEqual(listed[0]['itemCount'], 2)
        detail = self.client.get(f'/api/customer/orders/{mine}/').data
        self.assertNotIn('customer', detail)
        self.assertEqual(detail['history'][0]['changedBy'], 'You')

    def test_history_is_newest_first_and_stable_across_pages(self):
        Product.objects.filter(pk=self.milk.pk).update(stock=100)
        ids = [self.place(items=[{'productId': self.milk.id, 'quantity': 1}], requestId=str(uuid.uuid4())).data['id'] for _ in range(12)]
        first = self.client.get('/api/customer/orders/').data
        second = self.client.get('/api/customer/orders/?page=2').data
        listed = [o['id'] for o in first['results'] + second['results']]
        self.assertEqual(listed, list(reversed(ids)))

    def test_admin_list_is_newest_first(self):
        Product.objects.filter(pk=self.milk.pk).update(stock=100)
        ids = [self.place(items=[{'productId': self.milk.id, 'quantity': 1}], requestId=str(uuid.uuid4())).data['id'] for _ in range(4)]
        self.client.force_authenticate(self.staff)
        self.assertEqual([o['id'] for o in self.client.get('/api/orders/').data['results']], list(reversed(ids)))

    def test_customer_cannot_change_status_through_admin_api(self):
        order_id = self.place().data['id']
        res = self.client.post(f'/api/orders/{order_id}/status/', {'status': 'delivered'}, format='json')
        self.assertEqual(res.status_code, 403)
        self.assertEqual(Order.objects.get(pk=order_id).status, 'pending')


@override_settings(ORDER_DELIVERY_FEE=Decimal('150.00'), ORDER_FREE_DELIVERY_FROM=None)
class QuoteTests(OrderTestBase):
    def quote(self, items=None, **extra):
        payload = {'items': items or [{'productId': self.milk.id, 'quantity': 2}, {'productId': self.eggs.id, 'quantity': 1}]}
        payload.update(extra)
        return self.client.post('/api/customer/orders/quote/', payload, format='json')

    def test_quote_prices_from_the_database_and_includes_the_delivery_fee(self):
        res = self.quote(subtotal='1.00', total='1.00', deliveryFee='0.00')  # client amounts are ignored
        self.assertEqual(res.status_code, 200, res.data)
        self.assertEqual(res.data, {
            'items': [
                {'productId': self.milk.id, 'productName': 'Milk', 'unit': '1 L', 'unitPrice': '320.00', 'quantity': 2, 'lineTotal': '640.00'},
                {'productId': self.eggs.id, 'productName': 'Eggs', 'unit': '1 dozen', 'unitPrice': '390.50', 'quantity': 1, 'lineTotal': '390.50'},
            ],
            'subtotal': '1030.50',
            'deliveryFee': '150.00',
            'total': '1180.50',
            'freeDeliveryFrom': None,
        })

    def test_quote_matches_the_order_that_is_then_placed(self):
        quote = self.quote().data
        order = self.place().data
        self.assertEqual((order['subtotal'], order['deliveryFee'], order['total']), (quote['subtotal'], quote['deliveryFee'], quote['total']))

    @override_settings(ORDER_FREE_DELIVERY_FROM=Decimal('1000.00'))
    def test_quote_applies_free_delivery(self):
        data = self.quote().data
        self.assertEqual((data['deliveryFee'], data['total'], data['freeDeliveryFrom']), ('0.00', '1030.50', '1000.00'))
        small = self.quote(items=[{'productId': self.milk.id, 'quantity': 1}]).data
        self.assertEqual((small['deliveryFee'], small['total']), ('150.00', '470.00'))

    def test_quote_merges_repeated_products(self):
        data = self.quote(items=[{'productId': self.milk.id, 'quantity': 1}, {'productId': self.milk.id, 'quantity': 2}]).data
        self.assertEqual([(i['productId'], i['quantity']) for i in data['items']], [(self.milk.id, 3)])

    def test_quote_reports_the_same_problems_as_placing_and_changes_nothing(self):
        self.milk.is_available = False
        self.milk.save()
        res = self.quote(items=[
            {'productId': self.milk.id, 'quantity': 1}, {'productId': self.eggs.id, 'quantity': 5}, {'productId': 99999, 'quantity': 1},
        ])
        self.assertEqual(res.status_code, 400)
        self.assertEqual(res.data['detail'], 'Some items in your order need attention.')
        self.assertEqual(res.data['items'], [
            {'productId': self.milk.id, 'message': 'This product is no longer available.'},
            {'productId': self.eggs.id, 'message': 'Only 3 left in stock.', 'available': 3},
            {'productId': 99999, 'message': 'This product is no longer available.'},
        ])
        self.assertEqual(self.stock(self.eggs), 3)
        self.assertEqual(Order.objects.count(), 0)
        self.assertEqual(StockMovement.objects.count(), 0)

    def test_quote_never_reserves_stock(self):
        for _ in range(3):
            self.assertEqual(self.quote(items=[{'productId': self.eggs.id, 'quantity': 3}]).status_code, 200)
        self.assertEqual(self.stock(self.eggs), 3)
        self.assertEqual(Order.objects.count(), 0)

    def test_quote_validates_items(self):
        self.assertEqual(self.client.post('/api/customer/orders/quote/', {'items': []}, format='json').status_code, 400)
        res = self.quote(items=[{'productId': self.milk.id, 'quantity': 0}])
        self.assertEqual(res.status_code, 400)
        res = self.quote(items=[{'productId': self.milk.id, 'quantity': 101}])
        self.assertEqual(res.status_code, 400)

    def test_quote_is_for_signed_in_customers_only(self):
        self.client.force_authenticate(None)
        self.assertEqual(self.quote().status_code, 401)
        self.client.force_authenticate(self.staff)
        self.assertEqual(self.quote().status_code, 403)

    def test_quote_is_post_only(self):
        self.assertEqual(self.client.get('/api/customer/orders/quote/').status_code, 405)


class CancellationTests(OrderTestBase):
    def test_customer_cancels_pending_order_and_stock_is_restored(self):
        order_id = self.place().data['id']
        res = self.client.post(f'/api/customer/orders/{order_id}/cancel/', {'reason': 'Ordered by mistake'}, format='json')
        self.assertEqual(res.status_code, 200, res.data)
        self.assertEqual((res.data['status'], res.data['paymentStatus']), ('cancelled', 'void'))
        self.assertEqual(res.data['cancelReason'], 'Ordered by mistake')
        self.assertEqual((self.stock(self.milk), self.stock(self.eggs)), (10, 3))
        restocks = StockMovement.objects.filter(order_id=order_id, reason='order_cancelled')
        self.assertEqual(sorted(m.change for m in restocks), [1, 2])
        # Cancelling twice must not restock twice.
        self.assertEqual(self.client.post(f'/api/customer/orders/{order_id}/cancel/').status_code, 400)
        self.assertEqual(self.stock(self.milk), 10)

    def test_customer_cannot_cancel_after_confirmation(self):
        order_id = self.place().data['id']
        self.client.force_authenticate(self.staff)
        self.client.post(f'/api/orders/{order_id}/status/', {'status': 'confirmed'}, format='json')
        self.client.force_authenticate(self.customer)
        res = self.client.post(f'/api/customer/orders/{order_id}/cancel/')
        self.assertEqual(res.status_code, 400)
        self.assertIn('contact the store', res.data['detail'])
        self.assertEqual(self.stock(self.milk), 8)


class AdminOrderTests(OrderTestBase):
    def setUp(self):
        self.client.force_authenticate(self.customer)
        self.order_id = self.place().data['id']
        self.client.force_authenticate(self.staff)

    def set_status(self, new_status, note=''):
        return self.client.post(f'/api/orders/{self.order_id}/status/', {'status': new_status, 'note': note}, format='json')

    def test_full_lifecycle(self):
        for new_status in ['confirmed', 'preparing', 'out_for_delivery', 'delivered']:
            res = self.set_status(new_status)
            self.assertEqual(res.status_code, 200, res.data)
            self.assertEqual(res.data['status'], new_status)
        self.assertEqual(res.data['paymentStatus'], 'paid')
        self.assertEqual(res.data['allowedTransitions'], [])
        history = [(h['fromStatus'], h['toStatus'], h['changedBy']) for h in res.data['history']]
        self.assertEqual(history, [
            ('', 'pending', 'Ali'), ('pending', 'confirmed', 'Zaryab'), ('confirmed', 'preparing', 'Zaryab'),
            ('preparing', 'out_for_delivery', 'Zaryab'), ('out_for_delivery', 'delivered', 'Zaryab'),
        ])
        # Delivered is final: no cancelling, no going back, stock stays deducted.
        self.assertEqual(self.set_status('cancelled').status_code, 400)
        self.assertEqual(self.set_status('preparing').status_code, 400)
        self.assertEqual(self.stock(self.milk), 8)

    def test_invalid_transitions_are_refused(self):
        res = self.set_status('delivered')
        self.assertEqual(res.status_code, 400)
        self.assertEqual(res.data['detail'], "An order that is Pending can't be changed to Delivered.")
        self.assertEqual(self.set_status('pending').status_code, 400)
        self.assertEqual(self.set_status('shipped').status_code, 400)
        self.assertEqual(Order.objects.get(pk=self.order_id).status, 'pending')

    def test_staff_can_cancel_out_for_delivery_and_stock_returns(self):
        for new_status in ['confirmed', 'preparing', 'out_for_delivery']:
            self.set_status(new_status)
        res = self.set_status('cancelled', 'Customer refused delivery')
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data['cancelReason'], 'Customer refused delivery')
        self.assertEqual((self.stock(self.milk), self.stock(self.eggs)), (10, 3))
        self.assertEqual(self.set_status('confirmed').status_code, 400)

    def test_detail_includes_customer_and_delivery(self):
        res = self.client.get(f'/api/orders/{self.order_id}/')
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data['customer']['email'], 'ali@example.com')
        self.assertEqual(res.data['customerOrderCount'], 1)
        self.assertEqual(res.data['delivery']['area'], 'Gulberg')
        self.assertEqual(res.data['allowedTransitions'], ['confirmed', 'cancelled'])

    def test_list_search_filter_and_pagination(self):
        self.client.force_authenticate(self.other)
        self.client.post('/api/customer/orders/', {
            'items': [{'productId': self.milk.id, 'quantity': 1}], 'addressId': self.other_address.id,
        }, format='json')
        self.client.force_authenticate(self.staff)
        self.set_status('confirmed')

        res = self.client.get('/api/orders/')
        self.assertEqual(res.data['count'], 2)
        self.assertEqual(set(res.data['results'][0]), {
            'id', 'reference', 'status', 'statusLabel', 'itemCount', 'subtotal', 'deliveryFee', 'total',
            'paymentMethod', 'paymentStatus', 'createdAt', 'updatedAt', 'customer', 'deliveryArea',
        })
        reference = Order.objects.get(pk=self.order_id).reference
        self.assertEqual(self.client.get(f'/api/orders/?search={reference[-5:].lower()}').data['count'], 1)
        self.assertEqual(self.client.get('/api/orders/?search=sara').data['count'], 1)
        self.assertEqual(self.client.get('/api/orders/?search=03001234567').data['count'], 1)
        self.assertEqual(self.client.get('/api/orders/?status=confirmed').data['count'], 1)
        self.assertEqual(self.client.get('/api/orders/?status=open').data['count'], 2)
        self.assertEqual(self.client.get('/api/orders/?status=bogus').status_code, 400)
        self.assertEqual(len(self.client.get('/api/orders/?page_size=1').data['results']), 1)

    def test_summary(self):
        self.set_status('confirmed')
        self.set_status('preparing')
        self.set_status('out_for_delivery')
        self.set_status('delivered')
        self.client.force_authenticate(self.other)
        other_id = self.client.post('/api/customer/orders/', {
            'items': [{'productId': self.milk.id, 'quantity': 1}], 'addressId': self.other_address.id,
        }, format='json').data['id']
        self.client.post(f'/api/customer/orders/{other_id}/cancel/')
        self.client.force_authenticate(self.staff)

        res = self.client.get('/api/orders/summary/')
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data['total'], 2)
        self.assertEqual(res.data['open'], 0)
        self.assertEqual(res.data['today'], 2)
        self.assertEqual(res.data['byStatus']['delivered'], 1)
        self.assertEqual(res.data['byStatus']['cancelled'], 1)
        self.assertEqual(res.data['deliveredRevenue'], '1180.50')

    def test_anonymous_and_customers_are_kept_out(self):
        self.client.force_authenticate(None)
        self.assertEqual(self.client.get('/api/orders/').status_code, 401)
        self.client.force_authenticate(self.customer)
        self.assertEqual(self.client.get(f'/api/orders/{self.order_id}/').status_code, 403)


@unittest.skipUnless(connection.vendor == 'postgresql', 'Row locking needs PostgreSQL (SQLite runs one writer at a time).')
class ConcurrentOrderTests(TransactionTestCase):
    """Many customers order the last units at once: stock must never go negative or oversell."""

    def test_no_overselling_under_concurrency(self):
        dairy = Category.objects.get(name='Dairy & Eggs')
        product = Product.objects.create(name='Last Milk', category=dairy, unit='1 L', price=Decimal('100'), stock=5)
        buyers = []
        for i in range(12):
            user = User.objects.create_user(f'c{i}@example.com', email=f'c{i}@example.com', password='x')
            address = Address.objects.create(customer=user, recipient_name='C', phone='03000000000', line1='1', area='A', city='C')
            buyers.append((user, address))

        results = []
        barrier = threading.Barrier(len(buyers))

        def buy(user, address):
            barrier.wait()
            try:
                place_order(customer=user, address=address, items=[{'product_id': product.id, 'quantity': 1}],
                            payment_method='cash_on_delivery')
                results.append('ok')
            except Exception as exc:  # noqa: BLE001
                results.append(type(exc).__name__)
            finally:
                connection.close()

        threads = [threading.Thread(target=buy, args=b) for b in buyers]
        for t in threads:
            t.start()
        for t in threads:
            t.join()

        product.refresh_from_db()
        self.assertEqual(results.count('ok'), 5)
        self.assertEqual(product.stock, 0)
        self.assertEqual(Order.objects.count(), 5)
