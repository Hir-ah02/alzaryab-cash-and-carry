import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { FlatList, Pressable, RefreshControl, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { EmptyState, ErrorState, LoadingState } from '@/components/StateViews';
import { useCategories } from '@/hooks/useCatalog';
import { colors, radius, spacing, touchTarget } from '@/theme';

/** Categories with products on sale, from /api/catalog/categories/. */
export default function CategoriesScreen() {
  const categories = useCategories();

  if (categories.isPending) return <LoadingState label="Loading categories…" />;
  if (categories.isError) return <ErrorState error={categories.error} title="Couldn't load categories" onRetry={() => categories.refetch()} />;

  return (
    <FlatList
      style={styles.screen}
      contentContainerStyle={styles.content}
      data={categories.data}
      keyExtractor={(c) => String(c.id)}
      refreshControl={
        <RefreshControl
          refreshing={categories.isRefetching}
          onRefresh={() => {
            void categories.refetch();
          }}
          tintColor={colors.primary}
        />
      }
      ListEmptyComponent={<EmptyState icon="pricetags-outline" title="No categories yet" text="Categories appear here once products are on sale." />}
      renderItem={({ item }) => (
        <Pressable
          onPress={() => router.push({ pathname: '/category/[name]', params: { name: item.name } })}
          accessibilityRole="button"
          accessibilityLabel={`${item.name}, ${item.productCount} products`}
          style={({ pressed }) => [styles.row, pressed && styles.pressed]}
        >
          <View style={styles.icon}>
            <Ionicons name="pricetag-outline" size={20} color={colors.primary} />
          </View>
          <View style={styles.text}>
            <AppText variant="bodyStrong">{item.name}</AppText>
            <AppText variant="caption" color={colors.textSecondary}>
              {item.productCount} {item.productCount === 1 ? 'product' : 'products'}
            </AppText>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.textTertiary} />
        </Pressable>
      )}
    />
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, gap: spacing.sm, flexGrow: 1 },
  row: {
    minHeight: touchTarget + 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pressed: { backgroundColor: colors.surfaceMuted },
  icon: { width: 40, height: 40, borderRadius: radius.md, backgroundColor: colors.primaryTint, alignItems: 'center', justifyContent: 'center' },
  text: { flex: 1, gap: spacing.xxs },
});
