from rest_framework.routers import DefaultRouter

from .public import PublicCategoryViewSet, PublicProductViewSet
from .views import CategoryViewSet, ProductViewSet

router = DefaultRouter(trailing_slash=True)
router.include_root_view = False
# Admin portal (staff only)
router.register('categories', CategoryViewSet, basename='category')
router.register('products', ProductViewSet, basename='product')
# Customer app (public, read-only)
router.register('catalog/products', PublicProductViewSet, basename='catalog-product')
router.register('catalog/categories', PublicCategoryViewSet, basename='catalog-category')

urlpatterns = router.urls
