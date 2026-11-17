/** Products in one category (GET /catalog/products/?category=<name>), loaded a page at a time. */
import { router, Stack, useLocalSearchParams } from 'expo-router';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { ProductGrid } from '@/components/ProductGrid';
import { EmptyState } from '@/components/StateViews';
import { productListKey, useProductPages } from '@/hooks/useCatalog';
import { colors } from '@/theme';

export default function CategoryProductsScreen() {
  const { name = '' } = useLocalSearchParams<{ name: string }>();
  const products = useProductPages({ category: name }, { enabled: name.length > 0 });
  const count = products.data?.count ?? 0;

  return (
    <>
      <Stack.Screen options={{ title: name || 'Category' }} />
      <ProductGrid
        query={products}
        queryKey={productListKey({ category: name })}
        accessibilityLabel={`${name} products`}
        header={
          count > 0 ? (
            <AppText variant="caption" color={colors.textSecondary}>
              {count} {count === 1 ? 'product' : 'products'}
            </AppText>
          ) : undefined
        }
        empty={
          <EmptyState
            icon="pricetags-outline"
            title={`Nothing in ${name} right now`}
            text="Products in this category are sold out or not on sale at the moment."
            action={<Button title="Browse all products" variant="secondary" onPress={() => router.navigate('/')} />}
          />
        }
      />
    </>
  );
}

