from django.contrib import admin

from .models import Category, Product


@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    list_display = ['name', 'is_active', 'updated_at']
    list_filter = ['is_active']
    search_fields = ['name']


@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    list_display = ['name', 'category', 'unit', 'price', 'stock', 'is_available', 'is_active']
    list_filter = ['is_active', 'is_available', 'category']
    search_fields = ['name']
    # Stock changes go through the API so every change is logged as a StockMovement.
    readonly_fields = ['stock', 'created_at', 'updated_at']
