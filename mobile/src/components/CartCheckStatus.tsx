/**
 * The result of checking the cart against the live catalogue (useCartCheck):
 * checking, offline/error with retry, changes to accept, low stock, or OK.
 * Used by the cart and checkout screens.
 */
import type { UseQueryResult } from '@tanstack/react-query';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { ApiError, MESSAGES } from '@/api/errors';
import { describeIssue, resolveIssues, type CartProducts, type CartReview } from '@/cart/cartCheck';
import { useCart } from '@/cart/CartProvider';
import { colors, spacing } from '@/theme';
import { formatPrice } from '@/utils/format';

import { AppText } from './AppText';
import { Button } from './Button';
import { Notice } from './Notice';

/** True when the latest check is complete, fresh and found nothing to accept. */
export function isCartCheckReady(check: UseQueryResult<CartProducts>, review: CartReview | null): review is CartReview {
  return !check.isFetching && check.isSuccess && !!review && review.issues.length === 0 && review.unchecked.length === 0;
}

export function CartCheckStatus({ check, review }: { check: UseQueryResult<CartProducts>; review: CartReview | null }) {
  const { items, removeMany, update } = useCart();
  const issues = review?.issues ?? [];
  const checking = check.isFetching;

  if (check.isError && !checking) {
    const offline = check.error instanceof ApiError && check.error.isNetworkError;
    return (
      <Notice
        tone="error"
        title={offline ? "You're offline" : "Couldn't check your cart"}
        action={<Button title="Check again" icon="refresh" variant="secondary" onPress={() => void check.refetch()} />}
      >
        {`${check.error instanceof ApiError ? check.error.message : MESSAGES.server} Your cart is saved; prices and availability must be checked before checkout.`}
      </Notice>
    );
  }

  if (issues.length > 0) {
    const accept = () => {
      if (!check.data) return;
      const { remove, updates } = resolveIssues(issues, check.data);
      if (remove.length) removeMany(remove);
      if (updates.length) update(updates);
    };
    return (
      <Notice
        tone="warning"
        title="Some items have changed"
        action={<Button title="Accept changes" icon="checkmark" onPress={accept} disabled={checking} />}
      >
        <View style={styles.issueList}>
          {issues.map((issue) => (
            <AppText key={`${issue.kind}-${issue.productId}`} variant="label">
              • {describeIssue(issue, formatPrice)}
            </AppText>
          ))}
        </View>
      </Notice>
    );
  }

  if (!isCartCheckReady(check, review)) {
    return (
      <View style={styles.checking} accessibilityLabel="Checking prices and availability">
        <ActivityIndicator color={colors.primary} />
        <AppText variant="caption" color={colors.textSecondary}>
          Checking prices and availability…
        </AppText>
      </View>
    );
  }

  if (review.lowStock.length > 0) {
    const names = items.filter((i) => review.lowStock.includes(i.productId)).map((i) => i.name);
    return <Notice tone="info">{`Only a few left: ${names.join(', ')}. Stock is confirmed when you place your order.`}</Notice>;
  }
  return <Notice tone="success">Prices and availability checked just now.</Notice>;
}

const styles = StyleSheet.create({
  issueList: { gap: spacing.xs },
  checking: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md },
});
