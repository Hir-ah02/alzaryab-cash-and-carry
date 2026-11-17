/**
 * Cart: items saved on the device, quantities, subtotal estimate and the way
 * to checkout. Before checkout is offered, every product is re-read from the
 * catalogue; price changes, unit changes and products that can no longer be
 * bought must be accepted by the customer first. The server still checks
 * stock and prices again when the order is placed (Task 7).
 */
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { Alert, FlatList, StyleSheet, View, type ListRenderItemInfo } from 'react-native';

import { useAuth } from '@/auth/AuthProvider';
import { setReturnTo } from '@/auth/returnTo';
import { reviewCart, type CartIssue } from '@/cart/cartCheck';
import { useCart } from '@/cart/CartProvider';
import type { CartItem } from '@/cart/cartReducer';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { CartCheckStatus, isCartCheckReady } from '@/components/CartCheckStatus';
import { CartLine } from '@/components/CartLine';
import { EmptyState, LoadingState } from '@/components/StateViews';
import { useCartCheck } from '@/hooks/useCartCheck';
import { colors, radius, spacing } from '@/theme';
import { formatPrice } from '@/utils/format';

const FLAGS: Record<CartIssue['kind'], string> = {
  removed: 'No longer available',
  outOfStock: 'Out of stock',
  priceChanged: 'Price changed',
  unitChanged: 'Pack size changed',
};

function openProduct(productId: number) {
  router.push({ pathname: '/product/[id]', params: { id: String(productId) } });
}

export default function CartScreen() {
  const cart = useCart();
  const { items, count, subtotal, hydrated, setQuantity, remove, update, clear } = cart;
  const { status: authStatus } = useAuth();
  const { query: check, review } = useCartCheck(items, { enabled: hydrated });

  // Re-check whenever the customer comes back to the cart (the tab stays mounted).
  const firstFocus = useRef(true);
  const canCheck = hydrated && items.length > 0;
  const { refetch } = check;
  useFocusEffect(
    useCallback(() => {
      if (firstFocus.current) {
        firstFocus.current = false; // the first check runs on mount
        return;
      }
      if (canCheck) void refetch();
    }, [canCheck, refetch]),
  );

  // New names and photos change nothing the customer agreed to: take them silently.
  const quietUpdates = review?.quietUpdates;
  useEffect(() => {
    if (quietUpdates && quietUpdates.length > 0) update(quietUpdates);
  }, [quietUpdates, update]);

  const flags = useMemo(() => {
    const map = new Map<number, string>();
    for (const issue of review?.issues ?? []) if (!map.has(issue.productId)) map.set(issue.productId, FLAGS[issue.kind]);
    return map;
  }, [review]);

  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<CartItem>) => (
      <CartLine item={item} flag={flags.get(item.productId)} onChangeQuantity={setQuantity} onRemove={remove} onOpen={openProduct} />
    ),
    [flags, setQuantity, remove],
  );

  if (!hydrated) return <LoadingState label="Opening your cart…" />;

  if (items.length === 0) {
    return (
      <View style={styles.screen}>
        <EmptyState
          icon="cart-outline"
          title="Your cart is empty"
          text="Add products and they'll wait here, even if you close the app."
          action={<Button title="Start shopping" icon="storefront-outline" onPress={() => router.navigate('/')} />}
        />
      </View>
    );
  }

  const issues = review?.issues ?? [];
  const checking = check.isFetching;
  const ready = isCartCheckReady(check, review);

  const confirmClear = () => {
    Alert.alert('Clear your cart?', `This removes all ${count} items.`, [
      { text: 'Keep items', style: 'cancel' },
      { text: 'Clear cart', style: 'destructive', onPress: clear },
    ]);
  };

  const goToCheckout = async () => {
    // Re-read the catalogue right before leaving the cart, so readiness is never based on an old check.
    const latest = await check.refetch();
    if (!latest.isSuccess || !latest.data) return;
    const fresh = reviewCart(items, latest.data);
    if (fresh.issues.length > 0 || fresh.unchecked.length > 0) return;
    if (authStatus === 'signedOut') {
      // Sign in first, then come straight back to checkout. The cart stays on the device throughout.
      setReturnTo('/checkout');
      router.push('/login');
    } else {
      router.push('/checkout');
    }
  };

  const status = <CartCheckStatus check={check} review={review} />;

  const header = (
    <View style={styles.header}>
      <View style={styles.headerRow}>
        <AppText variant="heading" accessibilityRole="header">
          {count} {count === 1 ? 'item' : 'items'}
        </AppText>
        <Button title="Clear cart" variant="ghost" icon="trash-outline" onPress={confirmClear} />
      </View>
      {status}
    </View>
  );

  return (
    <View style={styles.screen}>
      <FlatList
        data={items}
        keyExtractor={(item) => String(item.productId)}
        renderItem={renderItem}
        ListHeaderComponent={header}
        contentContainerStyle={styles.content}
        accessibilityLabel="Cart items"
      />
      <View style={styles.summary}>
        <View style={styles.summaryRow}>
          <AppText color={colors.textSecondary}>Subtotal</AppText>
          <AppText variant="heading" accessibilityLabel={`Subtotal ${formatPrice(subtotal)}`}>
            {formatPrice(subtotal)}
          </AppText>
        </View>
        <AppText variant="caption" color={colors.textSecondary}>
          Delivery fee and final total are calculated at checkout. Pay cash on delivery.
        </AppText>
        <Button
          title={issues.length > 0 ? 'Accept changes to continue' : 'Continue to checkout'}
          icon="bag-check-outline"
          onPress={() => void goToCheckout()}
          disabled={!ready}
          loading={checking && check.isSuccess}
          fullWidth
          accessibilityHint="Checks your cart again, then opens checkout"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, gap: spacing.md },
  header: { gap: spacing.md },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  summary: {
    gap: spacing.sm,
    padding: spacing.lg,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
  },
  summaryRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
});
