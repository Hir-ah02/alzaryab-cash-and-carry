/**
 * Product page from GET /catalog/products/{id}/: photo, category, name, unit,
 * price, availability, description, quantity and Add to cart. Availability
 * shown here is a snapshot; stock is confirmed when the order is placed.
 */
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { AccessibilityInfo, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ApiError } from '@/api/errors';
import { useCart } from '@/cart/CartProvider';
import { MAX_QUANTITY_PER_ITEM } from '@/cart/cartReducer';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Notice } from '@/components/Notice';
import { ProductImage } from '@/components/ProductImage';
import { QuantityStepper } from '@/components/QuantityStepper';
import { ErrorState, LoadingState } from '@/components/StateViews';
import { StockBadge } from '@/components/StockBadge';
import { useProduct } from '@/hooks/useCatalog';
import { colors, radius, spacing } from '@/theme';
import { formatPrice } from '@/utils/format';

type Feedback = { tone: 'success' | 'warning'; text: string } | null;

export default function ProductDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const product = useProduct(id);
  const cart = useCart();
  const [quantity, setQuantity] = useState(1);
  const [feedback, setFeedback] = useState<Feedback>(null);

  const productId = product.data?.id;
  const inCart = productId === undefined ? 0 : cart.quantityOf(productId);
  const room = MAX_QUANTITY_PER_ITEM - inCart;

  // Keep the chosen quantity within what can still be added.
  useEffect(() => {
    if (room > 0 && quantity > room) setQuantity(room);
  }, [room, quantity]);

  if (product.isPending) return <LoadingState label="Loading product…" />;
  if (product.isError) {
    const notFound = product.error instanceof ApiError && product.error.status === 404;
    const numericId = Number(id);
    const savedInCart = notFound && cart.quantityOf(numericId) > 0;
    return (
      <ErrorState
        error={product.error}
        title={notFound ? 'This product is no longer available' : "Couldn't load product"}
        onRetry={notFound ? undefined : () => product.refetch()}
        action={
          savedInCart ? (
            <Button title="Remove it from my cart" variant="secondary" icon="trash-outline" onPress={() => cart.remove(numericId)} />
          ) : undefined
        }
      />
    );
  }

  const p = product.data;
  const outOfStock = !p.inStock;
  const limitReached = room <= 0;

  const addToCart = () => {
    const result = cart.add(p, quantity);
    let next: Feedback;
    if (result.ok) {
      const what = `${result.added} × ${p.name}`;
      next = result.capped
        ? { tone: 'warning', text: `Added ${what}. You can have up to ${MAX_QUANTITY_PER_ITEM} of one product.` }
        : { tone: 'success', text: `Added ${what} to your cart.` };
      setQuantity(1);
    } else if (result.reason === 'outOfStock') {
      next = { tone: 'warning', text: `${p.name} is out of stock.` };
    } else if (result.reason === 'limitReached') {
      next = { tone: 'warning', text: `You already have the most allowed (${MAX_QUANTITY_PER_ITEM}) in your cart.` };
    } else {
      next = { tone: 'warning', text: 'Choose a quantity of 1 or more.' };
    }
    setFeedback(next);
    AccessibilityInfo.announceForAccessibility(next.text);
  };

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ title: p.name }} />
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={product.isRefetching} onRefresh={() => void product.refetch()} tintColor={colors.primary} />}
      >
        <Card style={styles.imageCard}>
          <ProductImage uri={p.image} style={[styles.image, outOfStock && styles.dimmed]} iconSize={56} />
        </Card>
        <View style={styles.info}>
          <Pressable
            onPress={() => router.push({ pathname: '/category/[name]', params: { name: p.category } })}
            accessibilityRole="link"
            accessibilityLabel={`Category ${p.category}`}
            accessibilityHint="Shows other products in this category"
            hitSlop={8}
            style={styles.categoryLink}
          >
            <AppText variant="caption" color={colors.primary} style={styles.category}>
              {p.category.toUpperCase()}
            </AppText>
          </Pressable>
          <AppText variant="title" accessibilityRole="header">
            {p.name}
          </AppText>
          <AppText color={colors.textSecondary}>{p.unit}</AppText>
          <AppText variant="display">{formatPrice(p.price)}</AppText>
          <StockBadge status={p.stockStatus} />
          {!!p.description && <AppText style={styles.description}>{p.description}</AppText>}
        </View>
        <AppText variant="caption" color={colors.textSecondary}>
          Availability can change. The store confirms stock and the final price when you place your order.
        </AppText>
      </ScrollView>

      <View style={[styles.actions, { paddingBottom: insets.bottom + spacing.md }]}>
        {feedback && (
          <Notice
            tone={feedback.tone}
            action={
              feedback.tone === 'success' ? (
                <AppText variant="label" color={colors.primary} onPress={() => router.navigate('/cart')} accessibilityRole="link">
                  View cart
                </AppText>
              ) : undefined
            }
          >
            {feedback.text}
          </Notice>
        )}
        {inCart > 0 && (
          <AppText variant="caption" color={colors.textSecondary}>
            In your cart: {inCart}
          </AppText>
        )}
        {outOfStock ? (
          <Button title="Out of stock" icon="close-circle-outline" disabled fullWidth accessibilityHint="This product can't be added right now" />
        ) : (
          <View style={styles.buyRow}>
            <QuantityStepper value={quantity} max={Math.max(1, room)} onChange={setQuantity} disabled={limitReached} />
            <Button
              title={limitReached ? 'Cart limit reached' : 'Add to cart'}
              icon="cart-outline"
              onPress={addToCart}
              disabled={limitReached}
              style={styles.addButton}
            />
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, gap: spacing.xl },
  imageCard: { padding: spacing.lg },
  image: { width: '100%', aspectRatio: 1, backgroundColor: colors.surface },
  dimmed: { opacity: 0.5 },
  info: { gap: spacing.sm },
  categoryLink: { alignSelf: 'flex-start' },
  category: { fontWeight: '700', letterSpacing: 0.6 },
  description: { marginTop: spacing.sm },
  actions: {
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
  },
  buyRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  addButton: { flex: 1 },
});
