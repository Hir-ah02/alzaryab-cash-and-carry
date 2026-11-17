/**
 * One order (GET /customer/orders/{id}/): status, items, totals, delivery
 * address, payment and timeline. Cancelling is offered only when the server
 * says it is allowed (canCancel: Pending orders) and needs confirmation.
 */
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { Alert, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ApiError, MESSAGES } from '@/api/errors';
import type { OrderDetail } from '@/api/types';
import { AddressText } from '@/components/AddressCard';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Notice } from '@/components/Notice';
import { OrderStatusBadge } from '@/components/OrderStatusBadge';
import { ErrorState, LoadingState } from '@/components/StateViews';
import { SummaryRow } from '@/components/SummaryRow';
import { useCancelOrder, useOrder } from '@/hooks/useCustomer';
import { colors, radius, spacing } from '@/theme';
import { formatDateTime, formatPrice, PAYMENT_METHOD_LABELS, PAYMENT_STATUS_LABELS } from '@/utils/format';

const STATUS_NAMES: Record<string, string> = {
  pending: 'Order placed',
  confirmed: 'Confirmed by the store',
  preparing: 'Being prepared',
  out_for_delivery: 'Out for delivery',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
};

function Timeline({ order }: { order: OrderDetail }) {
  return (
    <View style={styles.timeline}>
      {order.history.map((entry, i) => (
        <View key={`${entry.toStatus}-${entry.createdAt}-${i}`} style={styles.step} accessible>
          <View style={[styles.dot, i === order.history.length - 1 && styles.dotCurrent]} />
          <View style={styles.stepText}>
            <AppText variant="bodyStrong">{STATUS_NAMES[entry.toStatus] ?? entry.toStatus}</AppText>
            <AppText variant="caption" color={colors.textSecondary}>
              {formatDateTime(entry.createdAt)}
              {entry.changedBy ? ` · ${entry.changedBy === 'You' ? 'by you' : 'by the store'}` : ''}
            </AppText>
            {!!entry.note && <AppText variant="caption">{entry.note}</AppText>}
          </View>
        </View>
      ))}
    </View>
  );
}

function OrderView({ order, justPlaced }: { order: OrderDetail; justPlaced: boolean }) {
  const insets = useSafeAreaInsets();
  const cancel = useCancelOrder(order.id);
  const refetch = useOrder(String(order.id)).refetch;

  const confirmCancel = () => {
    Alert.alert('Cancel this order?', `${order.reference} will be cancelled and nothing will be charged.`, [
      { text: 'Keep order', style: 'cancel' },
      { text: 'Cancel order', style: 'destructive', onPress: () => cancel.mutate('') },
    ]);
  };

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xxl }]}
      refreshControl={<RefreshControl refreshing={false} onRefresh={() => void refetch()} tintColor={colors.primary} />}
    >
      <Stack.Screen options={{ title: order.reference }} />
      {justPlaced && order.status !== 'cancelled' && (
        <Notice tone="success" title="Thank you! Your order has been placed">
          {`Order ${order.reference}. Please have ${formatPrice(order.total)} ready in cash when it arrives. We'll update the status here.`}
        </Notice>
      )}
      {cancel.isError && (
        <Notice tone="error" title="Couldn't cancel this order">
          {cancel.error instanceof ApiError ? cancel.error.message : MESSAGES.server}
        </Notice>
      )}

      <Card style={styles.card}>
        <View style={styles.headerRow}>
          <AppText variant="title" accessibilityRole="header">
            {order.reference}
          </AppText>
          <OrderStatusBadge status={order.status} label={order.statusLabel} />
        </View>
        <AppText color={colors.textSecondary}>Placed {formatDateTime(order.createdAt)}</AppText>
      </Card>

      <View style={styles.section}>
        <AppText variant="heading" accessibilityRole="header">
          Items
        </AppText>
        <Card style={styles.card}>
          {order.items.map((item) => (
            <View key={item.id} style={styles.line} accessible accessibilityLabel={`${item.quantity} × ${item.productName}, ${formatPrice(item.unitPrice)} each, ${formatPrice(item.lineTotal)}`}>
              <View style={styles.lineText}>
                <AppText variant="bodyStrong">{item.productName}</AppText>
                <AppText variant="caption" color={colors.textSecondary}>
                  {item.unit} · {item.quantity} × {formatPrice(item.unitPrice)}
                </AppText>
              </View>
              <AppText variant="bodyStrong">{formatPrice(item.lineTotal)}</AppText>
            </View>
          ))}
          <View style={styles.divider} />
          <SummaryRow label="Subtotal" value={formatPrice(order.subtotal)} />
          <SummaryRow label="Delivery fee" value={order.deliveryFee === 0 ? 'Free' : formatPrice(order.deliveryFee)} />
          <SummaryRow label="Total" value={formatPrice(order.total)} strong />
        </Card>
      </View>

      <View style={styles.section}>
        <AppText variant="heading" accessibilityRole="header">
          Delivery
        </AppText>
        <Card style={styles.card}>
          <AddressText address={order.delivery} />
          {!!order.customerNote && <AppText variant="caption">Your note: {order.customerNote}</AppText>}
        </Card>
      </View>

      <View style={styles.section}>
        <AppText variant="heading" accessibilityRole="header">
          Payment
        </AppText>
        <Card style={styles.card}>
          <SummaryRow label="Method" value={PAYMENT_METHOD_LABELS[order.paymentMethod] ?? order.paymentMethod} />
          <SummaryRow label="Status" value={PAYMENT_STATUS_LABELS[order.paymentStatus] ?? order.paymentStatus} />
        </Card>
      </View>

      {order.history.length > 0 && (
        <View style={styles.section}>
          <AppText variant="heading" accessibilityRole="header">
            Timeline
          </AppText>
          <Card style={styles.card}>
            <Timeline order={order} />
            {order.status === 'cancelled' && !!order.cancelReason && (
              <AppText variant="caption" color={colors.textSecondary}>
                Reason: {order.cancelReason}
              </AppText>
            )}
          </Card>
        </View>
      )}

      {order.canCancel && (
        <Button
          title="Cancel order"
          icon="close-circle-outline"
          variant="secondary"
          onPress={confirmCancel}
          loading={cancel.isPending}
          accessibilityHint="Asks for confirmation first"
        />
      )}
      {justPlaced && <Button title="Continue shopping" variant="ghost" icon="storefront-outline" onPress={() => router.navigate('/')} />}
    </ScrollView>
  );
}

export default function OrderDetailScreen() {
  const { id, placed } = useLocalSearchParams<{ id: string; placed?: string }>();
  const order = useOrder(id);

  if (order.isPending) return <LoadingState label="Loading order…" />;
  if (order.isError) {
    const notFound = order.error instanceof ApiError && order.error.status === 404;
    return <ErrorState error={order.error} title={notFound ? 'Order not found' : "Couldn't load this order"} onRetry={notFound ? undefined : () => order.refetch()} />;
  }
  return <OrderView order={order.data} justPlaced={placed === '1'} />;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, gap: spacing.xl },
  section: { gap: spacing.sm },
  card: { padding: spacing.lg, gap: spacing.md },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md, flexWrap: 'wrap' },
  line: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  lineText: { flex: 1, gap: spacing.xxs },
  divider: { height: 1, backgroundColor: colors.border },
  timeline: { gap: spacing.md },
  step: { flexDirection: 'row', gap: spacing.md },
  dot: { width: 12, height: 12, marginTop: 5, borderRadius: radius.full, backgroundColor: colors.borderStrong },
  dotCurrent: { backgroundColor: colors.primary },
  stepText: { flex: 1, gap: spacing.xxs },
});
