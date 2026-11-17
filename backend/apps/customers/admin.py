from django.contrib import admin

from .models import Address


@admin.register(Address)
class AddressAdmin(admin.ModelAdmin):
    list_display = ['recipient_name', 'customer', 'area', 'city', 'is_default']
    search_fields = ['recipient_name', 'customer__email', 'phone', 'area']
