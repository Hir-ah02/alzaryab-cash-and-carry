from django.conf import settings
from rest_framework import serializers

from .models import CUSTOMER_CANCELLABLE, Order, OrderItem, OrderStatus, OrderStatusChange, PaymentMethod


class OrderItemSerializer(serializers.ModelSerializer):
    productId = serializers.IntegerField(source='product_id', read_only=True)
    productName = serializers.CharField(source='product_name', read_only=True)
    unitPrice = serializers.DecimalField(source='unit_price', max_digits=10, decimal_places=2, read_only=True)
    lineTotal = serializers.DecimalField(source='line_total', max_digits=12, decimal_places=2, read_only=True)

    class Meta:
        model = OrderItem
        fields = ['id', 'productId', 'productName', 'unit', 'unitPrice', 'quantity', 'lineTotal']


class StatusChangeSerializer(serializers.ModelSerializer):
    fromStatus = serializers.CharField(source='from_status', read_only=True)
    toStatus = serializers.CharField(source='to_status', read_only=True)
    changedBy = serializers.SerializerMethodField()
    createdAt = serializers.DateTimeField(source='created_at', read_only=True)

    class Meta:
        model = OrderStatusChange
        fields = ['fromStatus', 'toStatus', 'note', 'changedBy', 'createdAt']

    def get_changedBy(self, obj):
        user = obj.changed_by
        if user is None:
            return None
        if self.context.get('for_customer'):
            return 'You' if user.pk == obj.order.customer_id else 'Store'
        return user.display_name


def delivery_data(order):
    return {
        'name': order.delivery_name,
        'phone': order.delivery_phone,
        'line1': order.delivery_line1,
        'line2': order.delivery_line2,
        'area': order.delivery_area,
        'city': order.delivery_city,
        'postalCode': order.delivery_postal_code,
        'instructions': order.delivery_instructions,
    }


class OrderSummarySerializer(serializers.ModelSerializer):
    """One row in an order list."""

    statusLabel = serializers.CharField(source='get_status_display', read_only=True)
    itemCount = serializers.IntegerField(source='item_count', read_only=True)
    deliveryFee = serializers.DecimalField(source='delivery_fee', max_digits=10, decimal_places=2, read_only=True)
    paymentMethod = serializers.CharField(source='payment_method', read_only=True)
    paymentStatus = serializers.CharField(source='payment_status', read_only=True)
    createdAt = serializers.DateTimeField(source='created_at', read_only=True)
    updatedAt = serializers.DateTimeField(source='updated_at', read_only=True)

    class Meta:
        model = Order
        fields = [
            'id', 'reference', 'status', 'statusLabel', 'itemCount', 'subtotal', 'deliveryFee', 'total',
            'paymentMethod', 'paymentStatus', 'createdAt', 'updatedAt',
        ]


class OrderDetailSerializer(OrderSummarySerializer):
    items = OrderItemSerializer(many=True, read_only=True)
    delivery = serializers.SerializerMethodField()
    customerNote = serializers.CharField(source='customer_note', read_only=True)
    cancelReason = serializers.CharField(source='cancel_reason', read_only=True)
    history = serializers.SerializerMethodField()
    canCancel = serializers.SerializerMethodField()

    class Meta(OrderSummarySerializer.Meta):
        fields = OrderSummarySerializer.Meta.fields + [
            'items', 'delivery', 'customerNote', 'cancelReason', 'history', 'canCancel',
        ]

    def get_delivery(self, order):
        return delivery_data(order)

    def get_history(self, order):
        return StatusChangeSerializer(order.status_history.all(), many=True, context=self.context).data

    def get_canCancel(self, order):
        return order.status in CUSTOMER_CANCELLABLE


def customer_data(user):
    return {
        'id': user.id,
        'name': user.display_name,
        'email': user.email,
        'phone': user.phone,
        'dateJoined': user.date_joined,
        'active': user.is_active,
    }


class AdminOrderSummarySerializer(OrderSummarySerializer):
    customer = serializers.SerializerMethodField()
    deliveryArea = serializers.CharField(source='delivery_area', read_only=True)

    class Meta(OrderSummarySerializer.Meta):
        fields = OrderSummarySerializer.Meta.fields + ['customer', 'deliveryArea']

    def get_customer(self, order):
        return {'id': order.customer_id, 'name': order.customer.display_name, 'email': order.customer.email}


class AdminOrderDetailSerializer(OrderDetailSerializer):
    customer = serializers.SerializerMethodField()
    allowedTransitions = serializers.ListField(source='allowed_transitions', read_only=True)
    customerOrderCount = serializers.SerializerMethodField()

    class Meta(OrderDetailSerializer.Meta):
        fields = [f for f in OrderDetailSerializer.Meta.fields if f != 'canCancel'] + [
            'customer', 'customerOrderCount', 'allowedTransitions',
        ]

    def get_customer(self, order):
        return customer_data(order.customer)

    def get_customerOrderCount(self, order):
        return order.customer.orders.count()


class OrderLineInputSerializer(serializers.Serializer):
    productId = serializers.IntegerField(min_value=1)
    quantity = serializers.IntegerField(min_value=1, max_value=settings.ORDER_MAX_QUANTITY_PER_ITEM)


class PlaceOrderSerializer(serializers.Serializer):
    """What the customer app sends. Prices and totals are never accepted from the client."""

    items = OrderLineInputSerializer(many=True, allow_empty=False, max_length=settings.ORDER_MAX_LINES)
    addressId = serializers.IntegerField(min_value=1)
    paymentMethod = serializers.ChoiceField(choices=PaymentMethod.choices, default=PaymentMethod.CASH_ON_DELIVERY)
    note = serializers.CharField(max_length=500, required=False, allow_blank=True, default='')
    requestId = serializers.UUIDField(required=False, allow_null=True, default=None)


class QuoteRequestSerializer(serializers.Serializer):
    """POST /api/customer/orders/quote/  The same items as placing an order; nothing else is needed to price it."""

    items = OrderLineInputSerializer(many=True, allow_empty=False, max_length=settings.ORDER_MAX_LINES)


def money(value):
    return f'{value:.2f}'


def quote_response(lines, subtotal, delivery_fee):
    """Decimal strings, like every other amount the API returns."""
    free_from = settings.ORDER_FREE_DELIVERY_FROM
    return {
        'items': [
            {
                'productId': product.id,
                'productName': product.name,
                'unit': product.unit,
                'unitPrice': money(product.price),
                'quantity': quantity,
                'lineTotal': money(line_total),
            }
            for product, quantity, line_total in lines
        ],
        'subtotal': money(subtotal),
        'deliveryFee': money(delivery_fee),
        'total': money(subtotal + delivery_fee),
        'freeDeliveryFrom': money(free_from) if free_from is not None else None,
    }


class StatusUpdateSerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=OrderStatus.choices)
    note = serializers.CharField(max_length=255, required=False, allow_blank=True, default='')


class CancelSerializer(serializers.Serializer):
    reason = serializers.CharField(max_length=255, required=False, allow_blank=True, default='')
