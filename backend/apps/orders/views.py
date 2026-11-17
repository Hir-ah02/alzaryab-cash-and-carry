from datetime import timedelta

from django.db.models import Count, Q, Sum
from django.utils import timezone
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response

from apps.core.permissions import IsCustomer, IsStaff
from apps.customers.models import Address

from .models import Order, OrderStatus
from .serializers import (
    AdminOrderDetailSerializer,
    AdminOrderSummarySerializer,
    CancelSerializer,
    OrderDetailSerializer,
    OrderSummarySerializer,
    PlaceOrderSerializer,
    QuoteRequestSerializer,
    StatusUpdateSerializer,
    quote_response,
)
from .services import change_status, place_order, quote_order

OPEN_STATUSES = [OrderStatus.PENDING, OrderStatus.CONFIRMED, OrderStatus.PREPARING, OrderStatus.OUT_FOR_DELIVERY]


# Count() adds a GROUP BY, and Django ignores Meta.ordering in GROUP BY queries,
# so list querysets must order explicitly (newest first, stable across pages).
NEWEST_FIRST = ('-created_at', '-id')


def with_details(queryset):
    return queryset.select_related('customer').prefetch_related('items', 'status_history__changed_by')


class CustomerOrderViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet):
    """
    The signed-in customer's own orders (others' orders return 404).
    GET  /api/customer/orders/               history, newest first
    POST /api/customer/orders/               place an order (Cash on Delivery)
    POST /api/customer/orders/quote/         prices, delivery fee and total for items, without ordering
    GET  /api/customer/orders/{id}/
    POST /api/customer/orders/{id}/cancel/   only while Pending
    """

    permission_classes = [IsCustomer]

    def get_queryset(self):
        queryset = Order.objects.filter(customer=self.request.user).annotate(item_count=Count('items')).order_by(*NEWEST_FIRST)
        return with_details(queryset) if self.action != 'list' else queryset

    def get_serializer_class(self):
        return OrderSummarySerializer if self.action == 'list' else OrderDetailSerializer

    def get_serializer_context(self):
        return {**super().get_serializer_context(), 'for_customer': True}

    def detail_response(self, order, status_code=status.HTTP_200_OK):
        order = self.get_queryset().get(pk=order.pk)
        return Response(OrderDetailSerializer(order, context=self.get_serializer_context()).data, status=status_code)

    def create(self, request):
        data = PlaceOrderSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        values = data.validated_data

        address = Address.objects.filter(pk=values['addressId'], customer=request.user).first()
        if address is None:
            raise ValidationError({'addressId': ['Choose one of your saved addresses.']})

        order, created = place_order(
            customer=request.user,
            address=address,
            items=[{'product_id': i['productId'], 'quantity': i['quantity']} for i in values['items']],
            payment_method=values['paymentMethod'],
            note=values['note'],
            request_id=values['requestId'],
        )
        return self.detail_response(order, status.HTTP_201_CREATED if created else status.HTTP_200_OK)

    @action(detail=False, methods=['post'])
    def quote(self, request):
        """
        200 {items, subtotal, deliveryFee, total, freeDeliveryFrom} priced from the database, or
        400 {detail, items: [{productId, message, available?}]} exactly as placing the order would.
        Reads only: no stock is reserved and nothing is saved.
        """
        data = QuoteRequestSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        lines, subtotal, delivery_fee = quote_order(
            items=[{'product_id': i['productId'], 'quantity': i['quantity']} for i in data.validated_data['items']],
        )
        return Response(quote_response(lines, subtotal, delivery_fee))

    @action(detail=True, methods=['post'])
    def cancel(self, request, pk=None):
        order = self.get_object()
        data = CancelSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        order = change_status(
            order, OrderStatus.CANCELLED, user=request.user, note=data.validated_data['reason'] or 'Cancelled by customer',
            by_customer=True,
        )
        return self.detail_response(order)


class AdminOrderViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Staff only.
    GET  /api/orders/?search=&status=&page=&page_size=
    GET  /api/orders/{id}/                 items, customer, delivery address, status history
    POST /api/orders/{id}/status/          {status, note?}  must follow the lifecycle
    GET  /api/orders/summary/              counts and revenue
    """

    permission_classes = [IsStaff]

    def get_queryset(self):
        queryset = Order.objects.annotate(item_count=Count('items')).order_by(*NEWEST_FIRST)
        if self.action != 'list':
            return with_details(queryset)

        queryset = queryset.select_related('customer')
        params = self.request.query_params
        search = params.get('search', '').strip()
        order_status = params.get('status', '').strip()
        if search:
            queryset = queryset.filter(
                Q(reference__icontains=search)
                | Q(customer__email__icontains=search)
                | Q(customer__first_name__icontains=search)
                | Q(customer__last_name__icontains=search)
                | Q(delivery_name__icontains=search)
                | Q(delivery_phone__icontains=search)
                | Q(customer__phone__icontains=search)
            )
        if order_status == 'open':
            queryset = queryset.filter(status__in=OPEN_STATUSES)
        elif order_status:
            if order_status not in OrderStatus.values:
                raise ValidationError({'status': [f'Must be one of: open, {", ".join(OrderStatus.values)}.']})
            queryset = queryset.filter(status=order_status)
        return queryset

    def get_serializer_class(self):
        return AdminOrderSummarySerializer if self.action == 'list' else AdminOrderDetailSerializer

    @action(detail=True, methods=['post'], url_path='status')
    def set_status(self, request, pk=None):
        order = self.get_object()
        data = StatusUpdateSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        change_status(order, data.validated_data['status'], user=request.user, note=data.validated_data['note'])
        order = self.get_queryset().get(pk=order.pk)
        return Response(AdminOrderDetailSerializer(order, context=self.get_serializer_context()).data)

    @action(detail=False)
    def summary(self, request):
        start_of_today = timezone.localtime().replace(hour=0, minute=0, second=0, microsecond=0)
        # Aliases must not reuse field names such as "total".
        counts = Order.objects.aggregate(
            n_orders=Count('id'),
            n_open=Count('id', filter=Q(status__in=OPEN_STATUSES)),
            n_today=Count('id', filter=Q(created_at__gte=start_of_today)),
            **{f'n_{s}': Count('id', filter=Q(status=s)) for s in OrderStatus.values},
            delivered_revenue=Sum('total', filter=Q(status=OrderStatus.DELIVERED)),
            last_7_days_revenue=Sum(
                'total',
                filter=Q(status=OrderStatus.DELIVERED, created_at__gte=start_of_today - timedelta(days=6)),
            ),
        )
        by_status = {s: counts[f'n_{s}'] for s in OrderStatus.values}
        return Response({
            'total': counts['n_orders'],
            'open': counts['n_open'],
            'today': counts['n_today'],
            'byStatus': {
                'pending': by_status['pending'],
                'confirmed': by_status['confirmed'],
                'preparing': by_status['preparing'],
                'outForDelivery': by_status['out_for_delivery'],
                'delivered': by_status['delivered'],
                'cancelled': by_status['cancelled'],
            },
            'deliveredRevenue': f"{counts['delivered_revenue'] or 0:.2f}",
            'last7DaysRevenue': f"{counts['last_7_days_revenue'] or 0:.2f}",
        })
