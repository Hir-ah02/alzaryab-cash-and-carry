/**
 * Account tab. Signed out: invitation to sign in or register. Signed in:
 * profile, saved addresses, recent orders and sign out.
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { router, type Href } from 'expo-router';
import { useState, type ComponentProps } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';

import type { OrderSummary } from '@/api/types';
import { useAuth } from '@/auth/AuthProvider';
import { AddressText } from '@/components/AddressCard';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { OrderStatusBadge } from '@/components/OrderStatusBadge';
import { SectionHeader } from '@/components/SectionHeader';
import { EmptyState, LoadingState } from '@/components/StateViews';
import { useAddresses, useOrderPages } from '@/hooks/useCustomer';
import { colors, radius, spacing, touchTarget } from '@/theme';
import { formatDate, formatPrice, PAYMENT_STATUS_LABELS } from '@/utils/format';

const RECENT_ORDERS = 3;

function MenuRow({ icon, label, href }: { icon: ComponentProps<typeof Ionicons>['name']; label: string; href: Href }) {
  return (
    <Pressable onPress={() => router.push(href)} accessibilityRole="button" style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
      <Ionicons name={icon} size={22} color={colors.primary} />
      <AppText variant="bodyStrong" style={styles.rowLabel}>
        {label}
      </AppText>
      <Ionicons name="chevron-forward" size={20} color={colors.textTertiary} />
    </Pressable>
  );
}

function SectionMessage({ text, onRetry }: { text: string; onRetry?: () => void }) {
  return (
    <View style={styles.sectionMessage}>
      <AppText color={onRetry ? colors.error : colors.textSecondary}>{text}</AppText>
      {onRetry && <Button title="Try again" variant="ghost" icon="refresh" onPress={onRetry} />}
    </View>
  );
}

export function OrderRow({ order }: { order: OrderSummary }) {
  return (
    <Pressable
      onPress={() => router.push({ pathname: '/orders/[id]', params: { id: String(order.id) } })}
      accessibilityRole="button"
      accessibilityLabel={`Order ${order.reference}, ${formatDate(order.createdAt)}, ${order.statusLabel}, ${formatPrice(order.total)}, ${PAYMENT_STATUS_LABELS[order.paymentStatus]}`}
      style={({ pressed }) => [styles.orderRow, pressed && styles.pressed]}
    >
      <View style={styles.orderText}>
        <AppText variant="bodyStrong">{order.reference}</AppText>
        <AppText variant="caption" color={colors.textSecondary}>
          {formatDate(order.createdAt)} · {order.itemCount} {order.itemCount === 1 ? 'item' : 'items'}
        </AppText>
        <AppText variant="caption" color={colors.textSecondary}>
          {PAYMENT_STATUS_LABELS[order.paymentStatus] ?? order.paymentStatus}
        </AppText>
      </View>
      <View style={styles.orderRight}>
        <AppText variant="bodyStrong">{formatPrice(order.total)}</AppText>
        <OrderStatusBadge status={order.status} label={order.statusLabel} />
      </View>
    </Pressable>
  );
}

function SignedInAccount() {
  const { customer, signOut, refreshProfile } = useAuth();
  const addresses = useAddresses();
  const orders = useOrderPages();
  const [refreshing, setRefreshing] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const refresh = async () => {
    setRefreshing(true);
    await Promise.all([refreshProfile(), addresses.refetch(), orders.refetch()]);
    setRefreshing(false);
  };

  const defaultAddress = addresses.data?.find((a) => a.isDefault) ?? addresses.data?.[0];
  const recent = orders.data?.orders.slice(0, RECENT_ORDERS) ?? [];

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} tintColor={colors.primary} />}
    >
      <Card style={styles.profile}>
        <View style={styles.profileTop}>
          <View style={styles.avatar}>
            <AppText variant="heading" color={colors.primaryPressed}>
              {(customer?.firstName?.[0] ?? '?').toUpperCase()}
            </AppText>
          </View>
          <View style={styles.profileText}>
            <AppText variant="heading">{customer?.name ?? 'Your account'}</AppText>
            {!!customer?.email && <AppText color={colors.textSecondary}>{customer.email}</AppText>}
            <AppText color={colors.textSecondary}>{customer?.phone || 'No phone number'}</AppText>
            {!!customer?.dateJoined && (
              <AppText variant="caption" color={colors.textTertiary}>
                Customer since {formatDate(customer.dateJoined)}
              </AppText>
            )}
          </View>
        </View>
        <Button title="Edit profile" icon="create-outline" variant="secondary" onPress={() => router.push('/profile')} />
      </Card>

      <View style={styles.section}>
        <SectionHeader title="Delivery address" actionLabel="Manage" onAction={() => router.push('/addresses')} />
        <Card style={styles.sectionCard}>
          {addresses.isPending ? (
            <ActivityIndicator color={colors.primary} accessibilityLabel="Loading addresses" />
          ) : addresses.isError ? (
            <SectionMessage text="Couldn't load your addresses." onRetry={() => void addresses.refetch()} />
          ) : defaultAddress ? (
            <>
              <AddressText address={defaultAddress} />
              {addresses.data.length > 1 && (
                <AppText variant="caption" color={colors.textSecondary}>
                  +{addresses.data.length - 1} more saved
                </AppText>
              )}
            </>
          ) : (
            <View style={styles.sectionMessage}>
              <AppText color={colors.textSecondary}>No saved addresses yet.</AppText>
              <Button title="Add an address" variant="ghost" icon="add" onPress={() => router.push('/addresses/new')} />
            </View>
          )}
        </Card>
      </View>

      <View style={styles.section}>
        <SectionHeader title="Recent orders" actionLabel={recent.length > 0 ? 'See all' : undefined} onAction={() => router.push('/orders')} />
        <Card>
          {orders.isPending ? (
            <View style={styles.sectionCard}>
              <ActivityIndicator color={colors.primary} accessibilityLabel="Loading orders" />
            </View>
          ) : orders.isError ? (
            <View style={styles.sectionCard}>
              <SectionMessage text="Couldn't load your orders." onRetry={() => void orders.refetch()} />
            </View>
          ) : recent.length === 0 ? (
            <View style={styles.sectionCard}>
              <SectionMessage text="No orders yet. Your orders will appear here." />
            </View>
          ) : (
            recent.map((order, i) => (
              <View key={order.id}>
                {i > 0 && <View style={styles.divider} />}
                <OrderRow order={order} />
              </View>
            ))
          )}
        </Card>
      </View>

      <Card>
        <MenuRow icon="receipt-outline" label="All orders" href="/orders" />
        <View style={styles.divider} />
        <MenuRow icon="location-outline" label="Delivery addresses" href="/addresses" />
      </Card>
      <Button
        title="Sign out"
        icon="log-out-outline"
        variant="secondary"
        loading={signingOut}
        onPress={() => {
          setSigningOut(true);
          void signOut();
        }}
        accessibilityHint="Your cart stays on this device"
      />
    </ScrollView>
  );
}

export default function AccountScreen() {
  const { status } = useAuth();

  if (status === 'restoring') return <LoadingState label="Checking your account…" />;
  if (status === 'signedIn') return <SignedInAccount />;

  return (
    <View style={styles.screen}>
      <EmptyState
        icon="person-circle-outline"
        title="Sign in to Al Zaryab"
        text="See your orders, save delivery addresses and check out faster."
        action={
          <View style={styles.actions}>
            <Button title="Sign in" onPress={() => router.push('/login')} fullWidth />
            <Button title="Create an account" variant="secondary" onPress={() => router.push('/register')} fullWidth />
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, gap: spacing.xl },
  actions: { alignSelf: 'stretch', gap: spacing.md, marginTop: spacing.sm },
  profile: { gap: spacing.lg, padding: spacing.lg },
  profileTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  avatar: { width: 56, height: 56, borderRadius: radius.full, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  profileText: { flex: 1, gap: spacing.xxs },
  section: { gap: spacing.sm },
  sectionCard: { padding: spacing.lg, gap: spacing.sm },
  sectionMessage: { gap: spacing.xs, alignItems: 'flex-start' },
  row: { minHeight: touchTarget + 8, flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg },
  rowLabel: { flex: 1 },
  pressed: { backgroundColor: colors.surfaceMuted },
  divider: { height: 1, backgroundColor: colors.border, marginLeft: spacing.lg },
  orderRow: { minHeight: touchTarget + 16, flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.lg },
  orderText: { flex: 1, gap: spacing.xxs },
  orderRight: { alignItems: 'flex-end', gap: spacing.xs },
});
