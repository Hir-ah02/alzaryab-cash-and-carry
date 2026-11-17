from rest_framework.permissions import BasePermission

from apps.accounts.models import can_use_admin_portal, is_customer


class IsStaff(BasePermission):
    """Admin portal API: active staff only, for reading and writing."""

    message = "You don't have permission to do that."

    def has_permission(self, request, view):
        return can_use_admin_portal(request.user)


class IsCustomer(BasePermission):
    """Customer API: signed-in, active, non-staff accounts."""

    message = 'This is only available to customer accounts.'

    def has_permission(self, request, view):
        return is_customer(request.user)
