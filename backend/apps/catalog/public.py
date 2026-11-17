"""
Public, read-only catalogue for the customer app: /api/catalog/...
Only active, available products in active categories. Exact stock counts
and admin fields are not exposed; stockStatus says in / low / out.
"""

from django.db.models import Count, Q
from rest_framework import mixins, serializers, viewsets
from rest_framework.permissions import AllowAny

from .models import Category, Product


def public_products():
    return Product.objects.filter(is_active=True, is_available=True, category__is_active=True).select_related('category')


class PublicProductSerializer(serializers.ModelSerializer):
    category = serializers.CharField(source='category.name', read_only=True)
    categoryId = serializers.IntegerField(source='category_id', read_only=True)
    stockStatus = serializers.CharField(source='stock_status', read_only=True)
    inStock = serializers.SerializerMethodField()

    class Meta:
        model = Product
        fields = ['id', 'name', 'category', 'categoryId', 'description', 'unit', 'price', 'image', 'stockStatus', 'inStock']

    def get_inStock(self, obj):
        return obj.stock > 0


class PublicCategorySerializer(serializers.ModelSerializer):
    productCount = serializers.IntegerField(source='product_count', read_only=True)

    class Meta:
        model = Category
        fields = ['id', 'name', 'description', 'productCount']


class PublicProductViewSet(viewsets.ReadOnlyModelViewSet):
    """GET /api/catalog/products/?search=&category=&page=   GET /api/catalog/products/{id}/"""

    serializer_class = PublicProductSerializer
    permission_classes = [AllowAny]
    authentication_classes = []

    def get_queryset(self):
        queryset = public_products().order_by('name', 'id')
        if self.action == 'list':
            search = self.request.query_params.get('search', '').strip()
            category = self.request.query_params.get('category', '').strip()
            if search:
                queryset = queryset.filter(name__icontains=search)
            if category:
                queryset = queryset.filter(category__name__iexact=category)
        return queryset


class PublicCategoryViewSet(mixins.ListModelMixin, viewsets.GenericViewSet):
    """GET /api/catalog/categories/  active categories with at least one product on sale."""

    serializer_class = PublicCategorySerializer
    permission_classes = [AllowAny]
    authentication_classes = []
    pagination_class = None

    def get_queryset(self):
        on_sale = Q(products__is_active=True, products__is_available=True)
        return (
            Category.objects.filter(is_active=True)
            .annotate(product_count=Count('products', filter=on_sale))
            .filter(product_count__gt=0)
            .order_by('name')
        )
