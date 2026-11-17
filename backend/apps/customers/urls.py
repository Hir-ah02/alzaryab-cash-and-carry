from django.urls import path
from rest_framework.routers import DefaultRouter

from apps.accounts.views import LogoutView

from . import views

router = DefaultRouter()
router.include_root_view = False
router.register('addresses', views.AddressViewSet, basename='customer-address')

urlpatterns = [
    path('auth/register/', views.CustomerRegisterView.as_view(), name='customer-register'),
    path('auth/login/', views.CustomerLoginView.as_view(), name='customer-login'),
    path('auth/refresh/', views.CustomerRefreshView.as_view(), name='customer-refresh'),
    path('auth/logout/', LogoutView.as_view(), name='customer-logout'),
    path('auth/password-reset/', views.PasswordResetRequestView.as_view(), name='customer-password-reset'),
    path('auth/password-reset/confirm/', views.PasswordResetConfirmView.as_view(), name='customer-password-reset-confirm'),
    path('profile/', views.ProfileView.as_view(), name='customer-profile'),
    *router.urls,
]
