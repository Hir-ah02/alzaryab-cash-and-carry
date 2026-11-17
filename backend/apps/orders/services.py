"""
Order placement and status changes. All stock changes for orders happen here.

Placing an order (one transaction):
  1. Lock the requested products' rows (in id order, so concurrent orders can't deadlock).
  2. Check each is active, available, in an active category, and has enough stock.
  3. Price every line from the database; the client sends only product ids and quantities.
  4. Create the order, deduct stock and log a StockMovement per line.
  Any failure rolls everything back, so a failed order never changes stock.

Quoting an order (POST /api/customer/orders/quote/) runs steps 2 and 3 without
locking or writing anything, so the app can show the authoritative prices,
delivery fee and total, and any stock problems, before the customer confirms.

Stock-restoration policy: cancelling an order (at any status before Delivered)
puts every item's quantity back into stock and logs an "order_cancelled"
movement. Delivered orders can't be cancelled, so delivered stock is never restored.
"""

from collections import OrderedDict
from decimal import Decimal

from django.conf import settings
from django.db import IntegrityError, transaction
from rest_framework.exceptions import APIException

from apps.catalog.models import Product
from apps.inventory.models import StockMovement
from apps.inventory.services import record_stock_change

from .models import (
    ALLOWED_TRANSITIONS,
    CUSTOMER_CANCELLABLE,
    Order,
    OrderItem,
    OrderStatus,
    OrderStatusChange,
    PaymentStatus,
    new_order_reference,
)


class OrderConflict(APIException):
    """
    An order can't be placed or changed as asked: 400 with {detail, items?}.
    Kept as given (not stringified like ValidationError) so the app gets numbers for productId/available.
    """

    status_code = 400
    default_code = 'order_conflict'

    def __init__(self, detail):
        super().__init__()
        self.detail = detail


def delivery_fee_for(subtotal):
    free_from = settings.ORDER_FREE_DELIVERY_FROM
    if free_from is not None and subtotal >= free_from:
        return Decimal('0.00')
    return settings.ORDER_DELIVERY_FEE


def merge_quantities(items):
    """[{'product_id', 'quantity'}, ...] → {product_id: total quantity}, keeping first-seen order."""
    quantities = OrderedDict()
    for item in items:
        quantities[item['product_id']] = quantities.get(item['product_id'], 0) + item['quantity']
    return quantities


def order_problems(quantities, products):
    """Why each requested line can't be ordered right now (empty list when all can)."""
    problems = []
    for product_id, quantity in quantities.items():
        product = products.get(product_id)
        if product is None or not product.is_active or not product.is_available or not product.category.is_active:
            problems.append({'productId': product_id, 'message': 'This product is no longer available.'})
        elif quantity > settings.ORDER_MAX_QUANTITY_PER_ITEM:
            problems.append({
                'productId': product_id,
                'message': f'You can order at most {settings.ORDER_MAX_QUANTITY_PER_ITEM} of one product.',
            })
        elif product.stock < quantity:
            message = 'This product is out of stock.' if product.stock == 0 else f'Only {product.stock} left in stock.'
            problems.append({'productId': product_id, 'message': message, 'available': product.stock})
    return problems


def price_lines(quantities, products):
    """Prices every line from the database. Returns ([(product, quantity, line_total)], subtotal, delivery_fee)."""
    lines = []
    subtotal = Decimal('0.00')
    for product_id, quantity in quantities.items():
        product = products[product_id]
        line_total = product.price * quantity
        subtotal += line_total
        lines.append((product, quantity, line_total))
    return lines, subtotal, delivery_fee_for(subtotal)


def quote_order(*, items):
    """
    What placing these items would cost right now, without reserving stock or
    creating anything. Raises OrderConflict with the same problems placement would.
    A quote is not a promise: place_order checks and prices everything again.
    """
    quantities = merge_quantities(items)
    products = {p.id: p for p in Product.objects.select_related('category').filter(id__in=quantities)}
    problems = order_problems(quantities, products)
    if problems:
        raise OrderConflict({'detail': 'Some items in your order need attention.', 'items': problems})
    return price_lines(quantities, products)


def place_order(*, customer, address, items, payment_method, note='', request_id=None):
    """
    items: [{'product_id': int, 'quantity': int}, ...] (already validated for shape).
    Returns (order, created). created is False when request_id matches an earlier order.
    """
    if request_id:
        existing = Order.objects.filter(customer=customer, request_id=request_id).first()
        if existing:
            return existing, False

    quantities = merge_quantities(items)

    try:
        with transaction.atomic():
            products = {
                p.id: p
                for p in Product.objects.select_for_update()
                .select_related('category')
                .filter(id__in=quantities)
                .order_by('id')
            }

            problems = order_problems(quantities, products)
            if problems:
                raise OrderConflict({'detail': 'Some items in your order need attention.', 'items': problems})

            lines, subtotal, delivery_fee = price_lines(quantities, products)

            order = Order.objects.create(
                reference=_unique_reference(),
                customer=customer,
                delivery_name=address.recipient_name,
                delivery_phone=address.phone,
                delivery_line1=address.line1,
                delivery_line2=address.line2,
                delivery_area=address.area,
                delivery_city=address.city,
                delivery_postal_code=address.postal_code,
                delivery_instructions=address.instructions,
                subtotal=subtotal,
                delivery_fee=delivery_fee,
                total=subtotal + delivery_fee,
                payment_method=payment_method,
                customer_note=note,
                request_id=request_id,
            )
            OrderItem.objects.bulk_create([
                OrderItem(
                    order=order,
                    product=product,
                    product_name=product.name,
                    unit=product.unit,
                    unit_price=product.price,
                    quantity=quantity,
                    line_total=line_total,
                )
                for product, quantity, line_total in lines
            ])
            for product, quantity, _ in lines:
                previous = product.stock
                product.stock = previous - quantity
                product.save(update_fields=['stock', 'updated_at'])
                record_stock_change(
                    product, previous, reason=StockMovement.Reason.ORDER, user=customer, order=order,
                    note=f'Order {order.reference}',
                )
            OrderStatusChange.objects.create(order=order, to_status=OrderStatus.PENDING, changed_by=customer)
    except IntegrityError:
        # A concurrent submit with the same request_id won the race: return that order.
        if request_id:
            existing = Order.objects.filter(customer=customer, request_id=request_id).first()
            if existing:
                return existing, False
        raise
    return order, True


def _unique_reference():
    for _ in range(5):
        reference = new_order_reference()
        if not Order.objects.filter(reference=reference).exists():
            return reference
    raise IntegrityError('Could not generate a unique order reference.')


def change_status(order, new_status, *, user, note='', by_customer=False):
    """Moves an order to new_status if the lifecycle allows it, with all side effects."""
    with transaction.atomic():
        order = Order.objects.select_for_update().get(pk=order.pk)
        current = order.status

        if by_customer and not (new_status == OrderStatus.CANCELLED and current in CUSTOMER_CANCELLABLE):
            raise OrderConflict({
                'detail': 'This order can no longer be cancelled online. Please contact the store.',
            })
        if new_status not in ALLOWED_TRANSITIONS[current]:
            raise OrderConflict({
                'detail': f"An order that is {OrderStatus(current).label} can't be changed to "
                          f'{OrderStatus(new_status).label}.',
            })

        update_fields = ['status', 'updated_at']
        order.status = new_status
        if new_status == OrderStatus.CANCELLED:
            order.payment_status = PaymentStatus.VOID
            order.cancel_reason = note[:255]
            update_fields += ['payment_status', 'cancel_reason']
            _restock(order, user)
        elif new_status == OrderStatus.DELIVERED:
            order.payment_status = PaymentStatus.PAID  # cash collected on delivery
            update_fields.append('payment_status')
        order.save(update_fields=update_fields)
        OrderStatusChange.objects.create(
            order=order, from_status=current, to_status=new_status, changed_by=user, note=note[:255]
        )
    return order


def _restock(order, user):
    items = list(order.items.all())
    products = {
        p.id: p for p in Product.objects.select_for_update().filter(id__in=[i.product_id for i in items]).order_by('id')
    }
    for item in items:
        product = products[item.product_id]
        previous = product.stock
        product.stock = previous + item.quantity
        product.save(update_fields=['stock', 'updated_at'])
        record_stock_change(
            product, previous, reason=StockMovement.Reason.ORDER_CANCELLED, user=user, order=order,
            note=f'Order {order.reference} cancelled',
        )
