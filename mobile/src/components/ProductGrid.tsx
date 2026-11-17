/**
 * Two-column product list with infinite scroll, pull-to-refresh, skeletons
 * and empty/error states. Used by Home, Search and category pages, all fed by
 * useProductPages().
 */
import { useQueryClient, type QueryKey, type UseInfiniteQueryResult } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useCallback, useMemo, useState, type ReactElement } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Platform,
  RefreshControl,
  StyleSheet,
  View,
  type ListRenderItemInfo,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import type { CatalogProduct } from '@/api/types';
import type { ProductList } from '@/hooks/useCatalog';
import { refreshFirstPage } from '@/lib/queryClient';
import { colors, spacing } from '@/theme';

import { AppText } from './AppText';
import { Button } from './Button';
import { ProductCard, ProductCardSkeleton } from './ProductCard';
import { ErrorState } from './StateViews';

type GridItem = { kind: 'product'; key: string; product: CatalogProduct } | { kind: 'skeleton' | 'filler'; key: string };

const SKELETONS: GridItem[] = Array.from({ length: 6 }, (_, i) => ({ kind: 'skeleton', key: `skeleton-${i}` }));

function openProduct(product: CatalogProduct) {
  router.push({ pathname: '/product/[id]', params: { id: String(product.id) } });
}

function renderItem({ item }: ListRenderItemInfo<GridItem>) {
  if (item.kind === 'product') return <ProductCard product={item.product} onPress={openProduct} />;
  if (item.kind === 'skeleton') return <ProductCardSkeleton />;
  return <View style={styles.filler} />;
}

const keyExtractor = (item: GridItem) => item.key;

interface ProductGridProps {
  query: UseInfiniteQueryResult<ProductList, Error>;
  /** The list's query key, so pull-to-refresh can reload just the first page. */
  queryKey: QueryKey;
  header?: ReactElement;
  /** Shown when the request succeeded but nothing matched. */
  empty: ReactElement;
  errorTitle?: string;
  /** Extra work for pull-to-refresh (e.g. Home also reloads categories). */
  onRefresh?: () => Promise<unknown>;
  contentContainerStyle?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}

export function ProductGrid({
  query,
  queryKey,
  header,
  empty,
  errorTitle = "Couldn't load products",
  onRefresh,
  contentContainerStyle,
  accessibilityLabel = 'Products',
}: ProductGridProps) {
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);
  const products = query.data?.products;
  const showSkeletons = query.isLoading;

  const data = useMemo<GridItem[]>(() => {
    if (showSkeletons) return SKELETONS;
    if (!products) return [];
    const items: GridItem[] = products.map((product) => ({ kind: 'product', key: String(product.id), product }));
    if (items.length % 2 === 1) items.push({ kind: 'filler', key: 'filler' }); // keeps a lone last card half width
    return items;
  }, [products, showSkeletons]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([refreshFirstPage(queryClient, queryKey), onRefresh?.()]);
    } finally {
      setRefreshing(false);
    }
  }, [queryClient, queryKey, onRefresh]);

  const { hasNextPage, isFetchingNextPage, isFetchNextPageError, fetchNextPage } = query;
  const loadMore = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage && !isFetchNextPageError) void fetchNextPage({ cancelRefetch: false });
  }, [hasNextPage, isFetchingNextPage, isFetchNextPageError, fetchNextPage]);

  let emptyComponent: ReactElement | undefined;
  if (query.isError && !products) {
    emptyComponent = <ErrorState error={query.error} title={errorTitle} onRetry={() => query.refetch()} />;
  } else if (query.isSuccess) {
    emptyComponent = empty;
  }

  let footer: ReactElement | undefined;
  if (isFetchingNextPage) {
    footer = (
      <View style={styles.footer} accessibilityLabel="Loading more products">
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  } else if (isFetchNextPageError) {
    footer = (
      <View style={styles.footer}>
        <AppText variant="caption" color={colors.error}>
          Couldn't load more products.
        </AppText>
        <Button title="Load more" icon="refresh" variant="secondary" onPress={() => void fetchNextPage()} />
      </View>
    );
  } else if (products && products.length > 0 && !hasNextPage) {
    footer = (
      <View style={styles.footer}>
        <AppText variant="caption" color={colors.textTertiary}>
          {products.length === 1 ? 'That’s the only product' : `That’s all ${products.length} products`}
        </AppText>
      </View>
    );
  }

  return (
    <FlatList
      style={styles.list}
      contentContainerStyle={[styles.content, contentContainerStyle]}
      data={data}
      keyExtractor={keyExtractor}
      renderItem={renderItem}
      numColumns={2}
      columnWrapperStyle={styles.columns}
      ListHeaderComponent={header}
      ListEmptyComponent={emptyComponent}
      ListFooterComponent={footer}
      onEndReached={loadMore}
      onEndReachedThreshold={0.6}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} colors={[colors.primary]} />}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      // Virtualisation: render a few screens around the visible area and recycle the rest.
      initialNumToRender={8}
      maxToRenderPerBatch={8}
      windowSize={7}
      removeClippedSubviews={Platform.OS === 'android'}
      accessibilityLabel={accessibilityLabel}
    />
  );
}

const styles = StyleSheet.create({
  list: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingBottom: spacing.xxxl, gap: spacing.md, flexGrow: 1 },
  columns: { gap: spacing.md },
  filler: { flex: 1 },
  footer: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.lg },
});
