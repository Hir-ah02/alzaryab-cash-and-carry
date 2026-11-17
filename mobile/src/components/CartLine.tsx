import Ionicons from '@expo/vector-icons/Ionicons';
import { memo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { lineTotal } from '@/api/money';
import type { CartItem } from '@/cart/cartReducer';
import { MAX_QUANTITY_PER_ITEM } from '@/cart/cartReducer';
import { colors, radius, spacing, touchTarget } from '@/theme';
import { formatPrice } from '@/utils/format';

import { AppText } from './AppText';
import { Card } from './Card';
import { ProductImage } from './ProductImage';
import { QuantityStepper } from './QuantityStepper';

interface CartLineProps {
  item: CartItem;
  /** Short warning from the latest cart check, e.g. "Out of stock". */
  flag?: string;
  /** Stable callbacks (from the cart provider), so unchanged rows don't re-render. */
  onChangeQuantity: (productId: number, quantity: number) => void;
  onRemove: (productId: number) => void;
  onOpen: (productId: number) => void;
}

export const CartLine = memo(function CartLine({ item, flag, onChangeQuantity, onRemove, onOpen }: CartLineProps) {
  return (
    <Card style={styles.card}>
      <Pressable
        onPress={() => onOpen(item.productId)}
        accessibilityRole="button"
        accessibilityLabel={`${item.name}, ${item.unit}, ${formatPrice(item.price)} each`}
        accessibilityHint="Opens the product details"
        style={styles.top}
      >
        <ProductImage uri={item.image} style={styles.image} iconSize={24} />
        <View style={styles.text}>
          <AppText variant="bodyStrong" numberOfLines={2}>
            {item.name}
          </AppText>
          <AppText variant="caption" color={colors.textSecondary}>
            {item.unit} · {formatPrice(item.price)} each
          </AppText>
          {flag && (
            <View style={styles.flag}>
              <AppText variant="caption" color={colors.warning} style={styles.flagText}>
                {flag}
              </AppText>
            </View>
          )}
        </View>
      </Pressable>
      <View style={styles.bottom}>
        <QuantityStepper
          compact
          value={item.quantity}
          max={MAX_QUANTITY_PER_ITEM}
          onChange={(quantity) => onChangeQuantity(item.productId, quantity)}
          label={`${item.name} quantity`}
        />
        <AppText variant="price" style={styles.total} accessibilityLabel={`Line total ${formatPrice(lineTotal(item.price, item.quantity))}`}>
          {formatPrice(lineTotal(item.price, item.quantity))}
        </AppText>
        <Pressable
          onPress={() => onRemove(item.productId)}
          accessibilityRole="button"
          accessibilityLabel={`Remove ${item.name}`}
          style={({ pressed }) => [styles.remove, pressed && styles.removePressed]}
        >
          <Ionicons name="trash-outline" size={20} color={colors.error} />
        </Pressable>
      </View>
    </Card>
  );
});

const styles = StyleSheet.create({
  card: { padding: spacing.md, gap: spacing.md },
  top: { flexDirection: 'row', gap: spacing.md },
  image: { width: 64, height: 64 },
  text: { flex: 1, gap: spacing.xxs },
  flag: { alignSelf: 'flex-start', paddingHorizontal: spacing.sm, paddingVertical: spacing.xxs, borderRadius: radius.full, backgroundColor: colors.warningBg },
  flagText: { fontWeight: '600' },
  bottom: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  total: { flex: 1, textAlign: 'right' },
  remove: { width: touchTarget, height: touchTarget, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md },
  removePressed: { backgroundColor: colors.errorBg },
});
