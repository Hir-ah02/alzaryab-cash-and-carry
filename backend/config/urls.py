from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path

from apps.orders.urls import admin_urlpatterns as admin_order_urls
from apps.orders.urls import customer_urlpatterns as customer_order_urls

urlpatterns = [
    path('api/', include('apps.core.urls')),
    # Admin portal (staff)
    path('api/', include('apps.accounts.urls')),
    path('api/', include('apps.catalog.urls')),  # also the public /api/catalog/ endpoints
    path('api/', include(admin_order_urls)),
    # Customer app
    path('api/customer/', include('apps.customers.urls')),
    path('api/customer/', include(customer_order_urls)),
]

# Django's built-in admin site (/admin/) has no login rate limit and isn't needed day to day (the
# React Admin Portal is the store's admin). It is on in development and off in production unless
# DJANGO_ADMIN_PATH is set (use a hard-to-guess path, e.g. "manage-7f3k2/").
if settings.DJANGO_ADMIN_PATH:
    urlpatterns.insert(0, path(settings.DJANGO_ADMIN_PATH, admin.site.urls))

# Uploaded product images in development. In production the web server serves MEDIA_ROOT.
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
