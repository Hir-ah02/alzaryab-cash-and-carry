"""
Test data for the customer website's browser tests. Runs ONLY inside the temporary
PostgreSQL schema created by scripts/e2e.sh (DB_SCHEMA=e2e_customer_web); refuses otherwise.
Usage: DB_SCHEMA=e2e_customer_web manage.py shell < seed.py
"""
import os
from decimal import Decimal

from django.conf import settings

assert settings.DB_SCHEMA.startswith('e2e_'), 'Refusing to seed outside an e2e_ schema'

from apps.accounts.models import User  # noqa: E402
from apps.catalog.models import Category, Product  # noqa: E402

staff_email = os.environ['E2E_STAFF_EMAIL']
User.objects.create_user(
    username=staff_email, email=staff_email, password=os.environ['E2E_STAFF_PASSWORD'],
    first_name='Test', last_name='Admin', is_staff=True,
)

cat = {c.name: c for c in Category.objects.all()}
rows = [
    # name, category, unit, price, stock, available, active
    ('E2E Basmati Rice', 'Rice & Flour', '5 kg', '1500.00', 50, True, True),
    ('E2E Sunflower Oil', 'Cooking Oil', '1 L', '600.00', 3, True, True),
    ('E2E Sugar', 'Rice & Flour', '1 kg', '200.00', 0, True, True),
    ('E2E Green Tea', 'Beverages', '25 bags', '350.00', 20, True, True),
    ('E2E Last Honey Jar', 'Snacks', '500 g', '900.00', 1, True, True),
    ('E2E Mineral Water', 'Beverages', '1.5 L', '100.00', 40, True, True),
    ('E2E Hidden Biscuits', 'Snacks', '1 pack', '120.00', 10, False, True),
    ('E2E Deleted Juice', 'Beverages', '1 L', '250.00', 10, True, False),
]
for name, category, unit, price, stock, available, active in rows:
    Product.objects.create(
        name=name, category=cat[category], unit=unit, price=Decimal(price), stock=stock,
        is_available=available, is_active=active, description=f'{name} for automated tests.',
    )
print(f'Seeded {Product.objects.count()} products and staff user in schema {settings.DB_SCHEMA}')
