"""
Field names follow the admin portal's product shape (camelCase, category
by name) so src/services/productService.js can switch to the API with
minimal changes.
"""

from decimal import Decimal

from django.db import transaction
from rest_framework import serializers

from apps.inventory.models import StockMovement
from apps.inventory.services import record_stock_change

from .models import Category, Product
from .validators import validate_product_image


class CategorySerializer(serializers.ModelSerializer):
    active = serializers.BooleanField(source='is_active', required=False)
    productCount = serializers.SerializerMethodField()
    createdAt = serializers.DateTimeField(source='created_at', read_only=True)
    updatedAt = serializers.DateTimeField(source='updated_at', read_only=True)

    class Meta:
        model = Category
        fields = ['id', 'name', 'description', 'active', 'productCount', 'createdAt', 'updatedAt']

    def get_productCount(self, obj):
        # Annotated by the viewset; counted directly for freshly created objects.
        count = getattr(obj, 'product_count', None)
        return count if count is not None else obj.products.filter(is_active=True).count()

    def validate_name(self, value):
        duplicates = Category.objects.filter(name__iexact=value)
        if self.instance:
            duplicates = duplicates.exclude(pk=self.instance.pk)
        if duplicates.exists():
            raise serializers.ValidationError('A category with this name already exists.')
        return value

    def validate(self, attrs):
        if self.instance and self.instance.is_active and attrs.get('is_active') is False:
            ensure_category_can_deactivate(self.instance)
        return attrs


def ensure_category_can_deactivate(category):
    count = category.products.filter(is_active=True).count()
    if count:
        raise serializers.ValidationError(
            {'detail': f'This category still has {count} active product(s). Move or remove them first.'}
        )


class ProductSerializer(serializers.ModelSerializer):
    category = serializers.SlugRelatedField(
        slug_field='name',
        queryset=Category.objects.filter(is_active=True),
        error_messages={'does_not_exist': 'Please select a valid category.'},
    )
    categoryId = serializers.IntegerField(source='category_id', read_only=True)
    price = serializers.DecimalField(max_digits=10, decimal_places=2, min_value=Decimal('0.01'))
    stockStatus = serializers.CharField(source='stock_status', read_only=True)
    image = serializers.ImageField(required=False, allow_null=True, validators=[validate_product_image])
    isAvailable = serializers.BooleanField(source='is_available', required=False)
    active = serializers.BooleanField(source='is_active', read_only=True)
    createdAt = serializers.DateTimeField(source='created_at', read_only=True)
    updatedAt = serializers.DateTimeField(source='updated_at', read_only=True)

    class Meta:
        model = Product
        fields = [
            'id', 'name', 'category', 'categoryId', 'description', 'unit', 'price', 'stock',
            'stockStatus', 'image', 'isAvailable', 'active', 'createdAt', 'updatedAt',
        ]
        extra_kwargs = {
            'name': {'error_messages': {'blank': 'Product name is required.'}},
            'unit': {'error_messages': {'blank': 'Unit is required.'}},
            'stock': {'min_value': 0},
            'description': {'max_length': 1000},
        }

    def validate(self, attrs):
        name = attrs.get('name', getattr(self.instance, 'name', None))
        unit = attrs.get('unit', getattr(self.instance, 'unit', None))
        if name and unit:
            duplicates = Product.objects.filter(is_active=True, name__iexact=name, unit__iexact=unit)
            if self.instance:
                duplicates = duplicates.exclude(pk=self.instance.pk)
            if duplicates.exists():
                raise serializers.ValidationError({'name': 'A product with this name and unit already exists.'})
        return attrs

    def _user(self):
        request = self.context.get('request')
        return getattr(request, 'user', None)

    def create(self, validated_data):
        if validated_data.get('image') is None:
            validated_data.pop('image', None)
        with transaction.atomic():
            product = super().create(validated_data)
            record_stock_change(product, 0, reason=StockMovement.Reason.INITIAL, user=self._user())
        return product

    def update(self, instance, validated_data):
        old_image = instance.image.name if instance.image else ''
        if 'image' in validated_data and validated_data['image'] is None:
            validated_data['image'] = ''

        with transaction.atomic():
            # Lock the row so concurrent edits can't lose a stock change.
            previous_stock = Product.objects.select_for_update().values_list('stock', flat=True).get(pk=instance.pk)
            product = super().update(instance, validated_data)
            record_stock_change(product, previous_stock, reason=StockMovement.Reason.ADJUSTMENT, user=self._user())

            new_image = product.image.name if product.image else ''
            if old_image and old_image != new_image:
                storage = instance.image.storage
                transaction.on_commit(lambda: storage.delete(old_image))
        return product


class StockMovementSerializer(serializers.ModelSerializer):
    quantityAfter = serializers.IntegerField(source='quantity_after', read_only=True)
    createdBy = serializers.SerializerMethodField()
    createdAt = serializers.DateTimeField(source='created_at', read_only=True)

    class Meta:
        model = StockMovement
        fields = ['id', 'change', 'quantityAfter', 'reason', 'note', 'createdBy', 'createdAt']

    def get_createdBy(self, obj):
        return obj.created_by.get_username() if obj.created_by else None
