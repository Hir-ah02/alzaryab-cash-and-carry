import Ionicons from '@expo/vector-icons/Ionicons';
import { memo, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import type { Address, OrderDelivery } from '@/api/types';
import { colors, radius, spacing } from '@/theme';

import { AppText } from './AppText';

type AddressLike = Pick<Address, 'line1' | 'line2' | 'area' | 'city' | 'postalCode' | 'instructions' | 'phone'> & {
  recipientName?: string;
  name?: string;
  label?: string;
  isDefault?: boolean;
};

export function addressLines(a: Pick<Address, 'line1' | 'line2' | 'area' | 'city' | 'postalCode'>): string {
  return [a.line1, a.line2, a.area, [a.city, a.postalCode].filter(Boolean).join(' ')].filter(Boolean).join(', ');
}

export function AddressText({ address }: { address: AddressLike | OrderDelivery }) {
  const a = address as AddressLike;
  const who = a.recipientName ?? a.name ?? '';
  return (
    <View style={styles.text}>
      <View style={styles.titleRow}>
        <AppText variant="bodyStrong">{a.label ? `${a.label} · ${who}` : who}</AppText>
        {a.isDefault && (
          <View style={styles.default}>
            <AppText variant="caption" color={colors.primaryPressed} style={styles.defaultText}>
              Default
            </AppText>
          </View>
        )}
      </View>
      <AppText color={colors.textSecondary}>{addressLines(a)}</AppText>
      <AppText variant="caption" color={colors.textSecondary}>
        {a.phone}
      </AppText>
      {!!a.instructions && (
        <AppText variant="caption" color={colors.textSecondary}>
          Note: {a.instructions}
        </AppText>
      )}
    </View>
  );
}

/** A saved address. With `onSelect` it is a radio option (checkout); `actions` go underneath. */
export const AddressCard = memo(function AddressCard({
  address,
  selected,
  onSelect,
  actions,
}: {
  address: Address;
  selected?: boolean;
  onSelect?: (id: number) => void;
  actions?: ReactNode;
}) {
  const body = (
    <View style={styles.row}>
      {onSelect && (
        <Ionicons name={selected ? 'radio-button-on' : 'radio-button-off'} size={22} color={selected ? colors.primary : colors.textTertiary} />
      )}
      <AddressText address={address} />
    </View>
  );
  return (
    <View style={[styles.card, selected && styles.selected]}>
      {onSelect ? (
        <Pressable
          onPress={() => onSelect(address.id)}
          accessibilityRole="radio"
          accessibilityState={{ checked: !!selected }}
          accessibilityLabel={`Deliver to ${address.label ? `${address.label}, ` : ''}${address.recipientName}, ${addressLines(address)}`}
        >
          {body}
        </Pressable>
      ) : (
        body
      )}
      {actions && <View style={styles.actions}>{actions}</View>}
    </View>
  );
});

const styles = StyleSheet.create({
  card: { padding: spacing.md, gap: spacing.sm, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  selected: { borderColor: colors.primary, backgroundColor: colors.primaryTint },
  row: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' },
  text: { flex: 1, gap: spacing.xxs },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },
  default: { paddingHorizontal: spacing.sm, paddingVertical: spacing.xxs, borderRadius: radius.full, backgroundColor: colors.primarySoft },
  defaultText: { fontWeight: '700' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
