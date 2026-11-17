/** The signed-in customer's orders (GET /customer/orders/), newest first, 10 at a time. */
import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, View, type ListRenderItemInfo } from 'react-native';

import type { OrderSummary } from '@/api/types';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { EmptyState, ErrorState, LoadingState } from '@/components/StateViews';
import { useOrderPages } from '@/hooks/useCustomer';
import { queryKeys, refreshFirstPage } from '@/lib/queryClient';
import { colors, spacing } from '@/theme';

import { OrderRow } from './AccountScreen';

const renderItem = ({ item }: ListRenderItemInfo<OrderSummary>) => (
  <Card>
    <OrderRow order={item} />
  </Card>
);

export default function OrdersScreen() {
  const queryClient = useQueryClient();
  const orders = useOrderPages();
  const [refreshing, setRefreshing] = useState(false);
  const { hasNextPage, isFetchingNextPage, isFetchNextPageError, fetchNextPage } = orders;

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refreshFirstPage(queryClient, queryKeys.orderPages);
    } finally {
      setRefreshing(false);
    }
  }, [queryClient]);

  const loadMore = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage && !isFetchNextPageError) void fetchNextPage({ cancelRefetch: false });
  }, [hasNextPage, isFetchingNextPage, isFetchNextPageError, fetchNextPage]);

  if (orders.isPending) return <LoadingState label="Loading your orders…" />;
  if (orders.isError && !orders.data) return <ErrorState error={orders.error} title="Couldn't load your orders" onRetry={() => orders.refetch()} />;

  const footer = isFetchingNextPage ? (
    <View style={styles.footer}>
      <ActivityIndicator color={colors.primary} accessibilityLabel="Loading more orders" />
    </View>
  ) : isFetchNextPageError ? (
    <View style={styles.footer}>
      <AppText variant="caption" color={colors.error}>
        Couldn't load more orders.
      </AppText>
      <Button title="Load more" variant="secondary" icon="refresh" onPress={() => void fetchNextPage()} />
    </View>
  ) : undefined;

  return (
    <FlatList
      style={styles.screen}
      contentContainerStyle={styles.content}
      data={orders.data.orders}
      keyExtractor={(o) => String(o.id)}
      renderItem={renderItem}
      onEndReached={loadMore}
      onEndReachedThreshold={0.5}
      ListFooterComponent={footer}
      ListEmptyComponent={
        <EmptyState
          icon="receipt-outline"
          title="No orders yet"
          text="When you place an order it appears here, with its status."
          action={<Button title="Start shopping" icon="storefront-outline" onPress={() => router.navigate('/')} />}
        />
      }
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} tintColor={colors.primary} />}
      accessibilityLabel="Your orders"
    />
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, gap: spacing.md, flexGrow: 1 },
  footer: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.lg },
});
