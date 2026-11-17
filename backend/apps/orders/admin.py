from django.contrib import admin

from .models import Order, OrderItem, OrderStatusChange


class OrderItemInline(admin.TabularInline):
    model = OrderItem
    extra = 0
    readonly_fields = ['product', 'product_name', 'unit', 'unit_price', 'quantity', 'line_total']
    can_delete = False


class StatusChangeInline(admin.TabularInline):
    model = OrderStatusChange
    extra = 0
    readonly_fields = ['from_status', 'to_status', 'note', 'changed_by', 'created_at']
    can_delete = False


@admin.register(Order)
class OrderAdmin(admin.ModelAdmin):
    """Read-only here: status changes go through the API so stock and history stay correct."""

    list_display = ['reference', 'customer', 'status', 'total', 'payment_status', 'created_at']
    list_filter = ['status', 'payment_status']
    search_fields = ['reference', 'customer__email', 'delivery_name', 'delivery_phone']
    inlines = [OrderItemInline, StatusChangeInline]

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False
