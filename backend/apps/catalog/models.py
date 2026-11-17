import uuid
from decimal import Decimal
from pathlib import Path

from django.core.validators import MinValueValidator
from django.db import models
from django.db.models.functions import Lower

from apps.inventory.stock import stock_status


class Category(models.Model):
    name = models.CharField(max_length=50)
    description = models.CharField(max_length=255, blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name_plural = 'categories'
        ordering = ['name']
        constraints = [
            models.UniqueConstraint(Lower('name'), name='category_name_unique_ci'),
        ]

    def __str__(self):
        return self.name


def product_image_path(instance, filename):
    """Random file name, so uploads never collide or leak the original name."""
    extension = Path(filename).suffix.lower()
    return f'products/{uuid.uuid4().hex}{extension}'


class Product(models.Model):
    name = models.CharField(max_length=80)
    category = models.ForeignKey(Category, on_delete=models.PROTECT, related_name='products')
    description = models.TextField(blank=True)
    unit = models.CharField(max_length=30, help_text='Pack size or weight sold per item, e.g. 1 L, 500 g.')
    price = models.DecimalField(max_digits=10, decimal_places=2, validators=[MinValueValidator(Decimal('0.01'))])
    stock = models.PositiveIntegerField(default=0)
    image = models.ImageField(upload_to=product_image_path, blank=True)
    # Shown to customers or hidden, independent of stock (e.g. seasonal items).
    is_available = models.BooleanField(default=True)
    # False once removed (soft delete); the row is kept for order history.
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at', '-id']
        constraints = [
            models.CheckConstraint(condition=models.Q(price__gt=0), name='product_price_positive'),
            # The same product name and unit can't be listed twice in active inventory.
            models.UniqueConstraint(
                Lower('name'),
                Lower('unit'),
                condition=models.Q(is_active=True),
                name='product_name_unit_unique_active',
            ),
        ]
        indexes = [
            models.Index(fields=['is_active', 'stock'], name='product_active_stock_idx'),
        ]

    def __str__(self):
        return f'{self.name} ({self.unit})'

    @property
    def stock_status(self):
        return stock_status(self.stock)
