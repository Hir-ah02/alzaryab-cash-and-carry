/**
 * Cash on Delivery checkout.
 *
 * Before the Place order button is enabled:
 *   - the cart is checked against the live catalogue (useCartCheck) and any
 *     price, pack-size or availability change has been accepted;
 *   - the server has priced the cart (POST /customer/orders/quote/): its
 *     subtotal, delivery fee and total are what's shown, and any stock problem
 *     ("Only 2 left") must be fixed first;
 *   - a saved delivery address is selected.
 * Pressing Place order checks and prices everything once more, then sends the
 * order with a requestId saved on the device first (see checkoutStore). The
 * cart is only changed after the server confirms the order.
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ActivityIndicator, Alert, StyleSheet, View } from 'react-native';

import { ApiError, MESSAGES } from '@/api/errors';
import { samePrice } from '@/api/money';
import type { OrderDetail, OrderLine, OrderProblem } from '@/api/types';
import { useAuth } from '@/auth/AuthProvider';
import { setReturnTo } from '@/auth/returnTo';
import { reviewCart } from '@/cart/cartCheck';
import { useCart } from '@/cart/CartProvider';
import {
  clearPendingSubmission,
  loadPendingSubmission,
  newRequestId,
  savePendingSubmission,
  selectCheckoutAddress,
  useCheckoutState,
  type PendingSubmission,
} from '@/checkout/checkoutStore';
import { submitOrder } from '@/checkout/submitOrder';
import { AddressCard } from '@/components/AddressCard';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { CartCheckStatus, isCartCheckReady } from '@/components/CartCheckStatus';
import { FormScreen } from '@/components/FormScreen';
import { Notice } from '@/components/Notice';
import { EmptyState, LoadingState } from '@/components/StateViews';
import { SummaryRow } from '@/components/SummaryRow';
import { TextField } from '@/components/TextField';
import { useCartCheck } from '@/hooks/useCartCheck';
import { useAddresses, useOrderQuote, useRememberOrder } from '@/hooks/useCustomer';
import { colors, spacing } from '@/theme';
import { formatPrice } from '@/utils/format';

import { MAX_ADDRESSES } from './AddressesScreen';

export const NOTE_MAX_LENGTH = 500;

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <AppText variant="heading" accessibilityRole="header">
        {title}
      </AppText>
      {children}
    </View>
  );
}

export default function CheckoutScreen() {
  const { status } = useAuth();
  const cart = useCart();
  const { items, hydrated, subtract, setQuantity, remove } = cart;
  const { addressId: chosenAddressId, pending, pendingLoaded } = useCheckoutState();
  const rememberOrder = useRememberOrder();

  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [totalChanged, setTotalChanged] = useState<number | null>(null);
  const [uncertain, setUncertain] = useState(false);
  const busy = useRef(false);

  useEffect(() => {
    void loadPendingSubmission();
  }, []);

  const lines = useMemo<OrderLine[]>(() => items.map((i) => ({ productId: i.productId, quantity: i.quantity })), [items]);
  const { query: check, review } = useCartCheck(items, { enabled: hydrated && !pending });
  const quote = useOrderQuote(lines, { enabled: hydrated && pendingLoaded && !pending });
  const addresses = useAddresses();

  const addressList = addresses.data ?? [];
  const selectedAddress =
    addressList.find((a) => a.id === chosenAddressId) ?? addressList.find((a) => a.isDefault) ?? addressList[0] ?? null;

  const problems: OrderProblem[] = quote.error instanceof ApiError ? quote.error.items : [];
  const quoteReady = quote.isSuccess && !quote.isFetching;
  const checkReady = isCartCheckReady(check, review);
  const ready = checkReady && quoteReady && !!selectedAddress && items.length > 0 && !pending && !submitting;

  const finish = (order: OrderDetail, sent: PendingSubmission) => {
    subtract(sent.items); // only now, with the order confirmed, does the cart change
    void clearPendingSubmission();
    rememberOrder(order);
    router.replace({ pathname: '/orders/[id]', params: { id: String(order.id), placed: '1' } });
  };

  const send = async (submission: PendingSubmission) => {
    const outcome = await submitOrder(submission);
    if (outcome.kind === 'placed') {
      finish(outcome.order, submission);
      return;
    }
    if (outcome.kind === 'uncertain') {
      setUncertain(true); // keep the pending submission: the same requestId is sent again
      return;
    }
    // Rejected: no order was created, so this requestId can be forgotten.
    await clearPendingSubmission();
    const error = outcome.error;
    if (error.status === 401) {
      setReturnTo('/checkout'); // the guard sends the customer to sign in; come back here after
      return;
    }
    if (error.items.length > 0) {
      setFormError('Some items changed while you were checking out. Review them below.');
      void quote.refetch();
      void check.refetch();
    } else if (error.fields.addressId) {
      setFormError(error.fields.addressId);
      selectCheckoutAddress(null);
      void addresses.refetch();
    } else {
      setFormError(error.message || MESSAGES.server);
    }
  };

  const placeOrder = async () => {
    if (busy.current || !selectedAddress || !quote.data) return;
    busy.current = true;
    setSubmitting(true);
    setFormError(null);
    setTotalChanged(null);
    try {
      const shownTotal = quote.data.total;
      // Check and price once more right before ordering; never order on an old check.
      const [latestCheck, latestQuote] = await Promise.all([check.refetch(), quote.refetch()]);
      if (!latestCheck.data || reviewCart(items, latestCheck.data).issues.length > 0) return; // shown by CartCheckStatus
      if (!latestQuote.isSuccess || !latestQuote.data) return; // problems are shown below
      if (!samePrice(latestQuote.data.total, shownTotal)) {
        setTotalChanged(latestQuote.data.total);
        return;
      }
      const submission: PendingSubmission = {
        requestId: newRequestId(),
        items: lines,
        addressId: selectedAddress.id,
        note: note.trim(),
        total: latestQuote.data.total,
        createdAt: new Date().toISOString(),
      };
      await savePendingSubmission(submission); // saved before sending, so a crash can't lose the requestId
      await send(submission);
    } catch {
      setFormError(MESSAGES.server);
    } finally {
      busy.current = false;
      setSubmitting(false);
    }
  };

  const retryPending = async () => {
    if (busy.current || !pending) return;
    busy.current = true;
    setSubmitting(true);
    setFormError(null);
    try {
      await send(pending);
    } finally {
      busy.current = false;
      setSubmitting(false);
    }
  };

  const discardPending = () => {
    Alert.alert(
      'Start a new order?',
      'If your earlier attempt reached us, it is already in My orders. Check there first so you don’t order twice.',
      [
        { text: 'Check My orders', onPress: () => router.push('/orders') },
        {
          text: 'Start over',
          style: 'destructive',
          onPress: () => {
            setUncertain(false);
            void clearPendingSubmission();
          },
        },
        { text: 'Cancel', style: 'cancel' },
      ],
    );
  };

  if (status !== 'signedIn' || !hydrated || !pendingLoaded) return <LoadingState label="Preparing checkout…" />;

  // An earlier submission's result is unknown: offer to send exactly the same order again.
  if (pending) {
    const count = pending.items.reduce((sum, l) => sum + l.quantity, 0);
    return (
      <FormScreen
        footer={
          <>
            <Button title="Try again" icon="refresh" onPress={() => void retryPending()} loading={submitting} fullWidth />
            <Button title="Start a new order instead" variant="ghost" onPress={discardPending} disabled={submitting} fullWidth />
          </>
        }
      >
        <Notice tone="warning" title="We couldn't confirm your order">
          {`${uncertain ? 'The connection dropped before Al Zaryab answered. ' : ''}Your order of ${count} ${
            count === 1 ? 'item' : 'items'
          } (${formatPrice(pending.total)}) may already have been received. Tap Try again: if it went through you'll see that same order, never a second one. Your cart is unchanged.`}
        </Notice>
        {formError && <Notice tone="error">{formError}</Notice>}
        <Button title="Check My orders" variant="secondary" icon="receipt-outline" onPress={() => router.push('/orders')} />
      </FormScreen>
    );
  }

  if (items.length === 0) {
    return (
      <EmptyState
        icon="cart-outline"
        title="Your cart is empty"
        text="Add products to your cart, then come back to check out."
        action={<Button title="Start shopping" icon="storefront-outline" onPress={() => router.navigate('/')} />}
      />
    );
  }

  const productName = (id: number) => items.find((i) => i.productId === id)?.name ?? 'A product';
  const placeLabel = quote.data && quoteReady ? `Place order · ${formatPrice(quote.data.total)}` : 'Place order';

  return (
    <FormScreen
      footer={
        <>
          <Button
            title={placeLabel}
            icon="bag-check-outline"
            onPress={() => void placeOrder()}
            disabled={!ready}
            loading={submitting}
            fullWidth
            accessibilityHint="Places a Cash on Delivery order"
          />
          {!selectedAddress && addresses.isSuccess && (
            <AppText variant="caption" color={colors.textSecondary} style={styles.center}>
              Add a delivery address to place your order.
            </AppText>
          )}
        </>
      }
    >
      {formError && (
        <Notice tone="error" title="Your order wasn't placed">
          {`${formError} Your cart is unchanged.`}
        </Notice>
      )}
      {totalChanged !== null && (
        <Notice tone="warning" title="The total has changed">
          {`The total is now ${formatPrice(totalChanged)}. Check the summary below and tap Place order again.`}
        </Notice>
      )}

      <Section title="Items">
        <CartCheckStatus check={check} review={review} />
        {problems.length > 0 && (
          <Notice tone="warning" title="Some items need attention">
            <View style={styles.problems}>
              {problems.map((p) => (
                <View key={p.productId} style={styles.problem}>
                  <AppText variant="label">{`${productName(p.productId)}: ${p.message}`}</AppText>
                  {p.available ? (
                    <Button title={`Change to ${p.available}`} variant="secondary" onPress={() => setQuantity(p.productId, p.available!)} />
                  ) : (
                    <Button title="Remove" variant="secondary" icon="trash-outline" onPress={() => remove(p.productId)} />
                  )}
                </View>
              ))}
            </View>
          </Notice>
        )}
        <Card style={styles.card}>
          {(quote.data?.items ?? items.map((i) => ({ productId: i.productId, productName: i.name, unit: i.unit, quantity: i.quantity, unitPrice: i.price, lineTotal: NaN }))).map(
            (line) => (
              <View key={line.productId} style={styles.line} accessible accessibilityLabel={`${line.quantity} × ${line.productName}, ${formatPrice(line.unitPrice)} each`}>
                <View style={styles.lineText}>
                  <AppText variant="bodyStrong">{line.productName}</AppText>
                  <AppText variant="caption" color={colors.textSecondary}>
                    {line.unit} · {line.quantity} × {formatPrice(line.unitPrice)}
                  </AppText>
                </View>
                {Number.isFinite(line.lineTotal) && <AppText variant="bodyStrong">{formatPrice(line.lineTotal)}</AppText>}
              </View>
            ),
          )}
          <Button title="Edit cart" variant="ghost" icon="create-outline" onPress={() => router.navigate('/cart')} />
        </Card>
      </Section>

      <Section title="Deliver to">
        {addresses.isPending ? (
          <ActivityIndicator color={colors.primary} accessibilityLabel="Loading addresses" />
        ) : addresses.isError ? (
          <Notice tone="error" title="Couldn't load your addresses" action={<Button title="Try again" variant="secondary" icon="refresh" onPress={() => void addresses.refetch()} />}>
            {addresses.error instanceof ApiError ? addresses.error.message : MESSAGES.server}
          </Notice>
        ) : (
          <View style={styles.addresses} accessibilityRole="radiogroup" accessibilityLabel="Delivery address">
            {addressList.map((a) => (
              <AddressCard key={a.id} address={a} selected={a.id === selectedAddress?.id} onSelect={selectCheckoutAddress} />
            ))}
            {addressList.length < MAX_ADDRESSES && (
              <Button
                title={addressList.length === 0 ? 'Add a delivery address' : 'Add another address'}
                variant={addressList.length === 0 ? 'primary' : 'ghost'}
                icon="add"
                onPress={() => router.push({ pathname: '/addresses/new', params: { from: 'checkout' } })}
              />
            )}
          </View>
        )}
      </Section>

      <Section title="Note for the store">
        <TextField
          label="Note (optional)"
          value={note}
          onChangeText={setNote}
          maxLength={NOTE_MAX_LENGTH}
          multiline
          placeholder="e.g. Please call when you arrive"
          helper={`${note.length}/${NOTE_MAX_LENGTH}`}
          style={styles.note}
        />
      </Section>

      <Section title="Payment">
        <Card style={[styles.card, styles.payment]}>
          <Ionicons name="cash-outline" size={24} color={colors.primary} />
          <View style={styles.lineText}>
            <AppText variant="bodyStrong">Cash on Delivery</AppText>
            <AppText variant="caption" color={colors.textSecondary}>
              Pay the rider in cash when your order arrives. No card needed.
            </AppText>
          </View>
        </Card>
      </Section>

      <Section title="Summary">
        <Card style={styles.card}>
          {quote.isPending || (quote.isFetching && !quote.data) ? (
            <View style={styles.checking} accessibilityLabel="Calculating your total">
              <ActivityIndicator color={colors.primary} />
              <AppText variant="caption" color={colors.textSecondary}>
                Calculating your total…
              </AppText>
            </View>
          ) : quote.isError && problems.length === 0 ? (
            <View style={styles.summaryError}>
              <AppText color={colors.error}>
                {quote.error instanceof ApiError && quote.error.isNetworkError ? "You're offline. " : ''}Couldn't calculate your total.
              </AppText>
              <Button title="Try again" variant="secondary" icon="refresh" onPress={() => void quote.refetch()} />
            </View>
          ) : quote.data ? (
            <>
              <SummaryRow label="Subtotal" value={formatPrice(quote.data.subtotal)} />
              <SummaryRow label="Delivery fee" value={quote.data.deliveryFee === 0 ? 'Free' : formatPrice(quote.data.deliveryFee)} />
              <View style={styles.divider} />
              <SummaryRow label="Total to pay on delivery" value={formatPrice(quote.data.total)} strong />
              {quote.data.freeDeliveryFrom !== null && quote.data.deliveryFee > 0 && (
                <AppText variant="caption" color={colors.textSecondary}>
                  Free delivery on orders from {formatPrice(quote.data.freeDeliveryFrom)}.
                </AppText>
              )}
              <AppText variant="caption" color={colors.textSecondary}>
                {problems.length > 0
                  ? 'Fix the items above to update your total.'
                  : 'Prices and delivery fee from Al Zaryab, checked just now. They are confirmed again when you place the order.'}
              </AppText>
            </>
          ) : (
            <AppText variant="caption" color={colors.textSecondary}>
              Fix the items above to see your total.
            </AppText>
          )}
        </Card>
      </Section>
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing.sm },
  card: { padding: spacing.lg, gap: spacing.md },
  line: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  lineText: { flex: 1, gap: spacing.xxs },
  addresses: { gap: spacing.sm },
  problems: { gap: spacing.md },
  problem: { gap: spacing.xs, alignItems: 'flex-start' },
  payment: { flexDirection: 'row', alignItems: 'center' },
  note: { minHeight: 72, paddingTop: spacing.md, textAlignVertical: 'top' },
  checking: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  summaryError: { gap: spacing.sm, alignItems: 'flex-start' },
  divider: { height: 1, backgroundColor: colors.border },
  center: { textAlign: 'center' },
});
