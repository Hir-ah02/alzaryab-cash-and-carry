from django.db.models import Count, Q
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.response import Response

from apps.core.permissions import IsStaff
from apps.inventory.stock import IN_STOCK, LOW_STOCK, OUT_OF_STOCK, STOCK_STATUSES, stock_status_q

from .models import Category, Product
from .serializers import CategorySerializer, ProductSerializer, StockMovementSerializer, ensure_category_can_deactivate


class CategoryViewSet(viewsets.ModelViewSet):
    """
    GET    /api/categories/                       active categories (?include_inactive=true for all)
    POST   /api/categories/                       create
    GET    /api/categories/{id}/                  any category, active or not
    PUT    /api/categories/{id}/                  update (set "active": true to reactivate)
    PATCH  /api/categories/{id}/
    DELETE /api/categories/{id}/                  deactivate (refused while it has active products)

    Not paginated: the list is small and the product form needs all of it.
    Staff only; customers use /api/catalog/.
    """

    serializer_class = CategorySerializer
    permission_classes = [IsStaff]
    pagination_class = None

    def get_queryset(self):
        # Explicit order: Meta.ordering isn't applied reliably once the query is grouped for the count.
        queryset = Category.objects.annotate(
            product_count=Count('products', filter=Q(products__is_active=True))
        ).order_by('name')
        include_inactive = self.request.query_params.get('include_inactive', '').lower() in {'1', 'true'}
        if self.action == 'list' and not include_inactive:
            queryset = queryset.filter(is_active=True)
        return queryset

    def destroy(self, request, *args, **kwargs):
        category = self.get_object()
        if category.is_active:
            ensure_category_can_deactivate(category)
            category.is_active = False
            category.save(update_fields=['is_active', 'updated_at'])
        return Response(status=status.HTTP_204_NO_CONTENT)


class ProductViewSet(viewsets.ModelViewSet):
    """
    GET    /api/products/?search=&category=&stock=in|low|out&active=true|false|all&page=&page_size=
    POST   /api/products/                         create (multipart/form-data for the image, or JSON)
    GET    /api/products/{id}/
    PUT    /api/products/{id}/                    update
    PATCH  /api/products/{id}/                    partial update (send image=null to remove it)
    DELETE /api/products/{id}/                    soft delete (row kept, hidden from inventory)
    GET    /api/products/summary/                 {total, inStock, lowStock, outOfStock}
    GET    /api/products/{id}/stock-movements/    stock change history

    The list shows active products unless ?active=false (removed only) or ?active=all is given, so the
    admin can still find removed (inactive) products. Every other action works on active products only,
    and the dashboard summary counts active products only. Staff only; customers use /api/catalog/.
    """

    ACTIVE_FILTERS = {'true': True, 'false': False, 'all': None}

    serializer_class = ProductSerializer
    permission_classes = [IsStaff]
    parser_classes = [JSONParser, MultiPartParser, FormParser]

    def get_queryset(self):
        queryset = Product.objects.select_related('category')
        if self.action != 'list':
            return queryset.filter(is_active=True)

        params = self.request.query_params
        active = params.get('active', 'true').strip().lower()
        if active not in self.ACTIVE_FILTERS:
            raise ValidationError({'active': 'Must be one of: true, false, all.'})
        if self.ACTIVE_FILTERS[active] is not None:
            queryset = queryset.filter(is_active=self.ACTIVE_FILTERS[active])

        search = params.get('search', '').strip()
        category = params.get('category', '').strip()
        stock = params.get('stock', '').strip().lower()

        if search:
            queryset = queryset.filter(name__icontains=search)
        if category:
            queryset = queryset.filter(category__name__iexact=category)
        if stock:
            if stock not in STOCK_STATUSES:
                raise ValidationError({'stock': f'Must be one of: {", ".join(STOCK_STATUSES)}.'})
            queryset = queryset.filter(stock_status_q(stock))
        return queryset

    def perform_destroy(self, instance):
        instance.is_active = False
        instance.save(update_fields=['is_active', 'updated_at'])

    @action(detail=False)
    def summary(self, request):
        counts = Product.objects.filter(is_active=True).aggregate(
            total=Count('id'),
            inStock=Count('id', filter=stock_status_q(IN_STOCK)),
            lowStock=Count('id', filter=stock_status_q(LOW_STOCK)),
            outOfStock=Count('id', filter=stock_status_q(OUT_OF_STOCK)),
        )
        return Response(counts)

    @action(detail=True, url_path='stock-movements')
    def stock_movements(self, request, pk=None):
        product = self.get_object()
        queryset = product.stock_movements.select_related('created_by')
        page = self.paginate_queryset(queryset)
        serializer = StockMovementSerializer(page, many=True)
        return self.get_paginated_response(serializer.data)
