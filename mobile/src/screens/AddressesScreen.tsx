/** The customer's saved delivery addresses (/customer/addresses/): add, edit, delete and choose the default. */
import { router } from 'expo-router';
import { useCallback } from 'react';
import { Alert, FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ApiError, MESSAGES } from '@/api/errors';
import type { Address } from '@/api/types';
import { AddressCard } from '@/components/AddressCard';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Notice } from '@/components/Notice';
import { EmptyState, ErrorState, LoadingState } from '@/components/StateViews';
import { useAddresses, useAddressMutations } from '@/hooks/useCustomer';
import { colors, spacing } from '@/theme';

/** Matches MAX_ADDRESSES_PER_CUSTOMER on the server. */
export const MAX_ADDRESSES = 10;

export default function AddressesScreen() {
  const insets = useSafeAreaInsets();
  const addresses = useAddresses();
  const { remove, makeDefault } = useAddressMutations();
  const mutationError = remove.error ?? makeDefault.error;

  const confirmDelete = useCallback(
    (address: Address) => {
      Alert.alert(
        'Delete this address?',
        `${address.label ? `${address.label}: ` : ''}${address.line1}, ${address.area}. Past orders keep their own copy.`,
        [
          { text: 'Keep', style: 'cancel' },
          { text: 'Delete', style: 'destructive', onPress: () => remove.mutate(address.id) },
        ],
      );
    },
    [remove],
  );

  if (addresses.isPending) return <LoadingState label="Loading addresses…" />;
  if (addresses.isError) return <ErrorState error={addresses.error} title="Couldn't load your addresses" onRetry={() => addresses.refetch()} />;

  const list = addresses.data;
  const full = list.length >= MAX_ADDRESSES;
  const busyId = remove.isPending ? remove.variables : makeDefault.isPending ? makeDefault.variables : undefined;

  return (
    <View style={styles.screen}>
      <FlatList
        data={list}
        keyExtractor={(a) => String(a.id)}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={addresses.isRefetching} onRefresh={() => void addresses.refetch()} tintColor={colors.primary} />}
        ListHeaderComponent={
          mutationError ? (
            <Notice tone="error" title="That didn't work">
              {mutationError instanceof ApiError ? mutationError.message : MESSAGES.server}
            </Notice>
          ) : undefined
        }
        ListEmptyComponent={
          <EmptyState icon="location-outline" title="No saved addresses" text="Add the address where you'd like your groceries delivered." />
        }
        renderItem={({ item }) => (
          <AddressCard
            address={item}
            actions={
              <>
                <Button
                  title="Edit"
                  variant="secondary"
                  icon="create-outline"
                  onPress={() => router.push({ pathname: '/addresses/[id]', params: { id: String(item.id) } })}
                  accessibilityHint={`Edit ${item.label || item.line1}`}
                />
                {!item.isDefault && (
                  <Button
                    title="Make default"
                    variant="ghost"
                    onPress={() => makeDefault.mutate(item.id)}
                    loading={busyId === item.id && makeDefault.isPending}
                    accessibilityHint={`Use ${item.label || item.line1} as your default address`}
                  />
                )}
                <Button
                  title="Delete"
                  variant="ghost"
                  icon="trash-outline"
                  onPress={() => confirmDelete(item)}
                  loading={busyId === item.id && remove.isPending}
                  accessibilityHint={`Delete ${item.label || item.line1}`}
                />
              </>
            }
          />
        )}
      />
      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}>
        {full && (
          <AppText variant="caption" color={colors.textSecondary}>
            You can save up to {MAX_ADDRESSES} addresses. Delete one to add another.
          </AppText>
        )}
        <Button title="Add a new address" icon="add" onPress={() => router.push('/addresses/new')} disabled={full} fullWidth />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, gap: spacing.md, flexGrow: 1 },
  footer: { gap: spacing.sm, paddingHorizontal: spacing.lg, paddingTop: spacing.md, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border },
});
