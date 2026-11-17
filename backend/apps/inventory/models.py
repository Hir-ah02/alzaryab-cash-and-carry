from django.conf import settings
from django.db import models


class StockMovement(models.Model):
    """Append-only log of every change to a product's stock quantity."""

    class Reason(models.TextChoices):
        INITIAL = 'initial', 'Initial stock'
        ADJUSTMENT = 'adjustment', 'Manual adjustment'
        ORDER = 'order', 'Customer order'
        ORDER_CANCELLED = 'order_cancelled', 'Order cancelled (restocked)'

    product = models.ForeignKey('catalog.Product', on_delete=models.PROTECT, related_name='stock_movements')
    change = models.IntegerField(help_text='Positive for stock added, negative for stock removed.')
    quantity_after = models.PositiveIntegerField()
    reason = models.CharField(max_length=20, choices=Reason.choices)
    note = models.CharField(max_length=255, blank=True)
    order = models.ForeignKey(
        'orders.Order', on_delete=models.PROTECT, null=True, blank=True, related_name='stock_movements'
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='stock_movements',
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at', '-id']
        constraints = [
            models.CheckConstraint(condition=~models.Q(change=0), name='stockmovement_change_nonzero'),
        ]

    def __str__(self):
        return f'{self.product} {self.change:+d} → {self.quantity_after}'
