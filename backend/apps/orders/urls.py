from rest_framework.routers import DefaultRouter

from .views import AdminOrderViewSet, CustomerOrderViewSet

admin_router = DefaultRouter()
admin_router.include_root_view = False
admin_router.register('orders', AdminOrderViewSet, basename='order')

customer_router = DefaultRouter()
customer_router.include_root_view = False
customer_router.register('orders', CustomerOrderViewSet, basename='customer-order')

admin_urlpatterns = admin_router.urls
customer_urlpatterns = customer_router.urls
