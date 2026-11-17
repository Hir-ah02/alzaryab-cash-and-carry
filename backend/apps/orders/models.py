import secrets

from django.conf import settings
from django.db import models
from django.db.models import F, Q

# Unambiguous characters for order references (no 0/O, 1/I/L).
REFERENCE_ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ'


def new_order_reference():
    """'AZ-7K3QF9MD': short enough to read over the phone, ~10^12 possibilities."""
    return 'AZ-' + ''.join(secrets.choice(REFERENCE_ALPHABET) for _ in range(8))


class OrderStatus(models.TextChoices):
    PENDING = 'pending', 'Pending'
    CONFIRMED = 'confirmed', 'Confirmed'
    PREPARING = 'preparing', 'Preparing'
    OUT_FOR_DELIVERY = 'out_for_delivery', 'Out for Delivery'
    DELIVERED = 'delivered', 'Delivered'
    CANCELLED = 'cancelled', 'Cancelled'


# The order lifecycle: Pending → Confirmed → Preparing → Out for Delivery → Delivered.
# Any order that hasn't been delivered can be cancelled by staff. Delivered and Cancelled are final.
ALLOWED_TRANSITIONS = {
    OrderStatus.PENDING: {OrderStatus.CONFIRMED, OrderStatus.CANCELLED},
    OrderStatus.CONFIRMED: {OrderStatus.PREPARING, OrderStatus.CANCELLED},
    OrderStatus.PREPARING: {OrderStatus.OUT_FOR_DELIVERY, OrderStatus.CANCELLED},
    OrderStatus.OUT_FOR_DELIVERY: {OrderStatus.DELIVERED, OrderStatus.CANCELLED},
    OrderStatus.DELIVERED: set(),
    OrderStatus.CANCELLED: set(),
}

# Customers may cancel their own order only before the store has confirmed it.
CUSTOMER_CANCELLABLE = {OrderStatus.PENDING}


class PaymentMethod(models.TextChoices):
    CASH_ON_DELIVERY = 'cash_on_delivery', 'Cash on Delivery'


class PaymentStatus(models.TextChoices):
    UNPAID = 'unpaid', 'Unpaid'
    PAID = 'paid', 'Paid'
    VOID = 'void', 'Void (order cancelled)'


class Order(models.Model):
    reference = models.CharField(max_length=20, unique=True, default=new_order_reference, editable=False)
    customer = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name='orders')
    status = models.CharField(max_length=20, choices=OrderStatus.choices, default=OrderStatus.PENDING)

    # Delivery address copied at checkout, so later address edits never change past orders.
    delivery_name = models.CharField(max_length=100)
    delivery_phone = models.CharField(max_length=16)
    delivery_line1 = models.CharField(max_length=200)
    delivery_line2 = models.CharField(max_length=200, blank=True)
    delivery_area = models.CharField(max_length=100)
    delivery_city = models.CharField(max_length=60)
    delivery_postal_code = models.CharField(max_length=10, blank=True)
    delivery_instructions = models.CharField(max_length=255, blank=True)

    subtotal = models.DecimalField(max_digits=12, decimal_places=2)
    delivery_fee = models.DecimalField(max_digits=10, decimal_places=2)
    total = models.DecimalField(max_digits=12, decimal_places=2)
    payment_method = models.CharField(
        max_length=20, choices=PaymentMethod.choices, default=PaymentMethod.CASH_ON_DELIVERY
    )
    payment_status = models.CharField(max_length=10, choices=PaymentStatus.choices, default=PaymentStatus.UNPAID)

    customer_note = models.CharField(max_length=500, blank=True)
    cancel_reason = models.CharField(max_length=255, blank=True)
    # Sent by the app with each checkout, so a retried or double-tapped submit can't create two orders.
    request_id = models.UUIDField(null=True, blank=True, editable=False)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at', '-id']
        constraints = [
            models.CheckConstraint(condition=Q(subtotal__gte=0), name='order_subtotal_non_negative'),
            models.CheckConstraint(condition=Q(delivery_fee__gte=0), name='order_delivery_fee_non_negative'),
            models.CheckConstraint(condition=Q(total=F('subtotal') + F('delivery_fee')), name='order_total_matches'),
            models.CheckConstraint(condition=Q(status__in=OrderStatus.values), name='order_status_valid'),
            models.UniqueConstraint(
                fields=['customer', 'request_id'], condition=Q(request_id__isnull=False), name='order_request_id_unique'
            ),
        ]
        indexes = [
            models.Index(fields=['status', '-created_at'], name='order_status_created_idx'),
        ]

    def __str__(self):
        return self.reference

    @property
    def allowed_transitions(self):
        return [s for s in OrderStatus.values if s in ALLOWED_TRANSITIONS[self.status]]


class OrderItem(models.Model):
    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name='items')
    product = models.ForeignKey('catalog.Product', on_delete=models.PROTECT, related_name='order_items')
    # Copied at checkout, so renaming or repricing a product never changes past orders.
    product_name = models.CharField(max_length=80)
    unit = models.CharField(max_length=30)
    unit_price = models.DecimalField(max_digits=10, decimal_places=2)
    quantity = models.PositiveIntegerField()
    line_total = models.DecimalField(max_digits=12, decimal_places=2)

    class Meta:
        ordering = ['id']
        constraints = [
            models.CheckConstraint(condition=Q(quantity__gt=0), name='orderitem_quantity_positive'),
            models.CheckConstraint(condition=Q(unit_price__gt=0), name='orderitem_unit_price_positive'),
            models.CheckConstraint(
                condition=Q(line_total=F('unit_price') * F('quantity')), name='orderitem_line_total_matches'
            ),
            models.UniqueConstraint(fields=['order', 'product'], name='orderitem_one_line_per_product'),
        ]

    def __str__(self):
        return f'{self.quantity} × {self.product_name}'


class OrderStatusChange(models.Model):
    """Append-only history of an order's status, including who changed it."""

    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name='status_history')
    from_status = models.CharField(max_length=20, choices=OrderStatus.choices, blank=True)
    to_status = models.CharField(max_length=20, choices=OrderStatus.choices)
    note = models.CharField(max_length=255, blank=True)
    changed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='+'
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['created_at', 'id']

    def __str__(self):
        return f'{self.order}: {self.from_status or "—"} → {self.to_status}'
