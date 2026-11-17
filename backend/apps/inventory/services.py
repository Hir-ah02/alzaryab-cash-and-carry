from .models import StockMovement


def record_stock_change(product, previous_quantity, *, reason, user=None, note='', order=None):
    """Log a stock change. Does nothing if the quantity did not change."""
    change = product.stock - previous_quantity
    if change == 0:
        return None
    return StockMovement.objects.create(
        product=product,
        change=change,
        quantity_after=product.stock,
        reason=reason,
        note=note,
        order=order,
        created_by=user if user and user.is_authenticated else None,
    )
