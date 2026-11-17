/**
 * Product search by name (GET /catalog/products/?search=, case-insensitive
 * "contains"). Requests wait until typing pauses, need at least two letters,
 * and reuse cached results; a newer search cancels the one in flight.
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useRef, useState, type ComponentRef } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { ProductGrid } from '@/components/ProductGrid';
import { EmptyState } from '@/components/StateViews';
import { productListKey, useProductPages } from '@/hooks/useCatalog';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { colors, radius, spacing, touchTarget, typography } from '@/theme';

export const SEARCH_DEBOUNCE_MS = 300;
export const MIN_SEARCH_LENGTH = 2;

export default function SearchScreen() {
  const inputRef = useRef<ComponentRef<typeof TextInput>>(null);
  const [text, setText] = useState('');
  const typed = text.trim();
  const [term, flush] = useDebouncedValue(typed, SEARCH_DEBOUNCE_MS);

  // Clearing or shortening the text takes effect at once; only new searches wait for the pause.
  const tooShort = typed.length < MIN_SEARCH_LENGTH;
  const activeTerm = tooShort ? '' : term;
  const enabled = activeTerm.length >= MIN_SEARCH_LENGTH;
  const results = useProductPages({ search: activeTerm }, { enabled, keepPrevious: true });
  const waiting = !tooShort && (term !== typed || results.isFetching) && !results.isFetchingNextPage;

  const clear = () => {
    setText('');
    inputRef.current?.focus();
  };

  const searchBox = (
    <View style={styles.box}>
      <Ionicons name="search" size={20} color={colors.textSecondary} />
      <TextInput
        ref={inputRef}
        value={text}
        onChangeText={setText}
        onSubmitEditing={flush}
        placeholder="Search milk, rice, atta…"
        placeholderTextColor={colors.textTertiary}
        accessibilityLabel="Search products"
        accessibilityRole="search"
        returnKeyType="search"
        autoFocus
        autoCorrect={false}
        autoCapitalize="none"
        maxLength={100}
        style={styles.input}
      />
      {waiting && <ActivityIndicator color={colors.primary} accessibilityLabel="Searching" />}
      {text.length > 0 && (
        <Pressable onPress={clear} accessibilityRole="button" accessibilityLabel="Clear search" hitSlop={8} style={styles.clear}>
          <Ionicons name="close-circle" size={20} color={colors.textTertiary} />
        </Pressable>
      )}
    </View>
  );

  let body;
  if (!enabled) {
    body = (
      <EmptyState
        icon="search-outline"
        title={typed.length === 0 ? 'Find a product' : 'Keep typing'}
        text={typed.length === 0 ? 'Search by product name, for example milk or rice.' : `Type at least ${MIN_SEARCH_LENGTH} letters to search.`}
        action={<Button title="Browse categories" variant="ghost" icon="grid-outline" onPress={() => router.navigate('/categories')} />}
      />
    );
  } else {
    const count = results.data?.count ?? 0;
    body = (
      <ProductGrid
        query={results}
        queryKey={productListKey({ search: activeTerm })}
        errorTitle="Search didn't work"
        accessibilityLabel="Search results"
        header={
          results.data && !results.isPlaceholderData && count > 0 ? (
            <AppText variant="caption" color={colors.textSecondary} accessibilityLiveRegion="polite">
              {count} {count === 1 ? 'result' : 'results'} for “{activeTerm}”
            </AppText>
          ) : undefined
        }
        empty={
          <EmptyState
            icon="sad-outline"
            title={`No products match “${activeTerm}”`}
            text="Check the spelling, or try a shorter word."
            action={<Button title="Browse categories" variant="secondary" onPress={() => router.navigate('/categories')} />}
          />
        }
      />
    );
  }

  return (
    <View style={styles.screen}>
      <View style={styles.searchBar}>{searchBox}</View>
      {body}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  searchBar: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.xs },
  box: {
    minHeight: touchTarget,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  input: { ...typography.body, flex: 1, minHeight: touchTarget, color: colors.text },
  clear: { padding: spacing.xs },
});
