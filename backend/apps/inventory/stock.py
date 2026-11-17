"""
Stock rule, mirroring src/utils/stock.js in the admin portal:
  stock > LOW_STOCK_THRESHOLD   -> in
  stock 1..LOW_STOCK_THRESHOLD  -> low
  stock 0                       -> out
"""

from django.conf import settings
from django.db.models import Q

IN_STOCK = 'in'
LOW_STOCK = 'low'
OUT_OF_STOCK = 'out'
STOCK_STATUSES = (IN_STOCK, LOW_STOCK, OUT_OF_STOCK)


def low_stock_threshold():
    return settings.LOW_STOCK_THRESHOLD


def stock_status(quantity):
    if quantity <= 0:
        return OUT_OF_STOCK
    if quantity <= low_stock_threshold():
        return LOW_STOCK
    return IN_STOCK


def stock_status_q(status, field='stock'):
    """Queryset filter for a stock status, e.g. Product.objects.filter(stock_status_q('low'))."""
    threshold = low_stock_threshold()
    if status == OUT_OF_STOCK:
        return Q(**{f'{field}__lte': 0})
    if status == LOW_STOCK:
        return Q(**{f'{field}__gte': 1, f'{field}__lte': threshold})
    if status == IN_STOCK:
        return Q(**{f'{field}__gt': threshold})
    raise ValueError(f'Unknown stock status: {status}')
