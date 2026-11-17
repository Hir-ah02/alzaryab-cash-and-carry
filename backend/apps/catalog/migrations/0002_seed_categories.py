from django.db import migrations

# The 12 categories used by the admin portal (src/data/categories.js).
CATEGORIES = [
    'Fruits & Vegetables',
    'Dairy & Eggs',
    'Beverages',
    'Snacks',
    'Bakery',
    'Rice & Flour',
    'Cooking Oil',
    'Spices',
    'Frozen Foods',
    'Personal Care',
    'Household & Cleaning',
    'Baby Care',
]


def seed_categories(apps, schema_editor):
    Category = apps.get_model('catalog', 'Category')
    for name in CATEGORIES:
        if not Category.objects.filter(name__iexact=name).exists():
            Category.objects.create(name=name)


class Migration(migrations.Migration):
    dependencies = [
        ('catalog', '0001_initial'),
    ]

    # Reversing leaves the categories in place rather than deleting data.
    operations = [
        migrations.RunPython(seed_categories, migrations.RunPython.noop),
    ]
