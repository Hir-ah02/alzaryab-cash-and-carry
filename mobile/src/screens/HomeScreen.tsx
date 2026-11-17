/**
 * Home: brand header, search entry, categories and every product on sale
 * from the live catalogue API (/api/catalog/), loaded a page at a time as the
 * customer scrolls. No product data is built into the app.
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useCallback } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '@/auth/AuthProvider';
import { AppText } from '@/components/AppText';
import { BrandMark } from '@/components/BrandMark';
import { CategoryChip } from '@/components/CategoryChip';
import { ProductGrid } from '@/components/ProductGrid';
import { SearchEntry } from '@/components/SearchEntry';
import { SectionHeader } from '@/components/SectionHeader';
import { EmptyState } from '@/components/StateViews';
import { productListKey, useCategories, useProductPages } from '@/hooks/useCatalog';
import { colors, radius, spacing } from '@/theme';

function CategoriesSection() {
  const categories = useCategories();

  if (categories.isError) {
    return (
      <View style={styles.inlineError}>
        <AppText variant="caption" color={colors.error}>
          Couldn't load categories.
        </AppText>
        <AppText variant="caption" color={colors.primary} onPress={() => categories.refetch()} accessibilityRole="button">
          Try again
        </AppText>
      </View>
    );
  }
  if (categories.isPending) {
    return (
      <View style={styles.chipRow} accessibilityLabel="Loading categories">
        {[96, 120, 84].map((width) => (
          <View key={width} style={[styles.chipSkeleton, { width }]} />
        ))}
      </View>
    );
  }
  if (categories.data.length === 0) return null;

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
      {categories.data.map((c) => (
        <CategoryChip
          key={c.id}
          name={c.name}
          count={c.productCount}
          onPress={() => router.push({ pathname: '/category/[name]', params: { name: c.name } })}
        />
      ))}
    </ScrollView>
  );
}

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { customer } = useAuth();
  const products = useProductPages({});
  const categories = useCategories();
  const refetchCategories = categories.refetch;
  const refreshCategories = useCallback(() => refetchCategories(), [refetchCategories]);
  const count = products.data?.count;

  const header = (
    <View style={styles.header}>
      <View style={styles.brandRow}>
        <BrandMark />
      </View>
      <View>
        <AppText variant="title">{customer ? `Hi, ${customer.firstName}` : 'Fresh groceries, delivered'}</AppText>
        <View style={styles.codRow}>
          <Ionicons name="cash-outline" size={16} color={colors.textSecondary} />
          <AppText variant="caption" color={colors.textSecondary}>
            Pay cash on delivery
          </AppText>
        </View>
      </View>
      <SearchEntry onPress={() => router.push('/search')} />
      <View style={styles.section}>
        <SectionHeader title="Shop by category" actionLabel="See all" onAction={() => router.push('/categories')} />
        <CategoriesSection />
      </View>
      <View style={styles.titleRow}>
        <AppText variant="heading" accessibilityRole="header">
          All products
        </AppText>
        {count !== undefined && count > 0 && (
          <AppText variant="caption" color={colors.textSecondary}>
            {count} {count === 1 ? 'product' : 'products'}
          </AppText>
        )}
      </View>
    </View>
  );

  return (
    <ProductGrid
      query={products}
      queryKey={productListKey({})}
      header={header}
      onRefresh={refreshCategories}
      contentContainerStyle={{ paddingTop: insets.top + spacing.lg }}
      empty={<EmptyState icon="basket-outline" title="No products yet" text="The store is adding products. Pull down to check again." />}
    />
  );
}

const styles = StyleSheet.create({
  header: { gap: spacing.xl, marginBottom: spacing.xs },
  brandRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  codRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: spacing.xs },
  section: { gap: spacing.md },
  chipRow: { flexDirection: 'row', gap: spacing.sm, paddingRight: spacing.lg },
  chipSkeleton: { height: 40, borderRadius: radius.full, backgroundColor: colors.border },
  titleRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  inlineError: { flexDirection: 'row', gap: spacing.md, alignItems: 'center' },
});
