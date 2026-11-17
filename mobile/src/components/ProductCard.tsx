import { memo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import type { CatalogProduct } from '@/api/types';
import { colors, radius, spacing } from '@/theme';
import { formatPrice, STOCK_LABELS } from '@/utils/format';

import { AppText } from './AppText';
import { Card } from './Card';
import { ProductImage } from './ProductImage';
import { StockBadge } from './StockBadge';

interface ProductCardProps {
  product: CatalogProduct;
  /** Receives the product, so lists can pass one stable function to every card. */
  onPress?: (product: CatalogProduct) => void;
}

/** Memoised: in long lists a card re-renders only when its own product changes. */
export const ProductCard = memo(function ProductCard({ product, onPress }: ProductCardProps) {
  const outOfStock = !product.inStock;

  return (
    <Pressable
      onPress={onPress && (() => onPress(product))}
      accessibilityRole="button"
      accessibilityLabel={`${product.name}, ${product.unit}, ${formatPrice(product.price)}, ${STOCK_LABELS[product.stockStatus]}`}
      accessibilityHint="Opens the product details"
      style={({ pressed }) => [styles.pressable, pressed && styles.pressed]}
    >
      <Card style={styles.card}>
        <ProductImage uri={product.image} style={[styles.image, outOfStock && styles.dimmed]} />
        <View style={styles.body}>
          <AppText variant="label" numberOfLines={2} style={styles.name}>
            {product.name}
          </AppText>
          <AppText variant="caption" color={colors.textSecondary} numberOfLines={1}>
            {product.unit}
          </AppText>
          <AppText variant="price" color={outOfStock ? colors.textSecondary : colors.text}>
            {formatPrice(product.price)}
          </AppText>
          <StockBadge status={product.stockStatus} />
        </View>
      </Card>
    </Pressable>
  );
});

export function ProductCardSkeleton() {
  return (
    <View style={styles.pressable} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Card style={styles.card}>
        <View style={[styles.image, styles.skeleton]} />
        <View style={styles.body}>
          <View style={[styles.skeletonLine, { width: '85%' }]} />
          <View style={[styles.skeletonLine, { width: '40%' }]} />
          <View style={[styles.skeletonLine, { width: '55%', height: 16 }]} />
        </View>
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  pressable: { flex: 1 },
  pressed: { opacity: 0.85 },
  card: { flex: 1, padding: spacing.md, gap: spacing.md },
  image: { width: '100%', aspectRatio: 1 },
  dimmed: { opacity: 0.5 },
  body: { gap: spacing.xs },
  name: { minHeight: 40 },
  skeleton: { backgroundColor: colors.border },
  skeletonLine: { height: 12, borderRadius: radius.sm, backgroundColor: colors.border },
});
