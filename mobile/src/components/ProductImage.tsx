import Ionicons from '@expo/vector-icons/Ionicons';
import { memo, useState } from 'react';
import { Image, Platform, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { colors, radius } from '@/theme';

/**
 * Product photo, or a neutral placeholder when there is none or it fails to load.
 *
 * Caching: Django saves every upload under a new random file name, so a URL
 * never changes content. iOS is therefore told to use its disk cache without
 * revalidating ('force-cache'); Android's image pipeline (Fresco) keeps memory
 * and disk caches by default. On Android, `resizeMethod="resize"` decodes the
 * photo at display size, which keeps memory low in long lists.
 */
function ProductImageView({ uri, style, iconSize = 32 }: { uri: string | null; style?: StyleProp<ViewStyle>; iconSize?: number }) {
  const [failedUri, setFailedUri] = useState<string | null>(null);
  const showImage = !!uri && failedUri !== uri;

  return (
    <View style={[styles.frame, style]}>
      {showImage ? (
        <Image
          source={{ uri, cache: 'force-cache' }}
          style={StyleSheet.absoluteFill}
          resizeMode="contain"
          resizeMethod={Platform.OS === 'android' ? 'resize' : 'auto'}
          onError={() => setFailedUri(uri)}
          accessibilityIgnoresInvertColors
        />
      ) : (
        <Ionicons name="basket-outline" size={iconSize} color={colors.textTertiary} accessibilityLabel="No product photo" />
      )}
    </View>
  );
}

export const ProductImage = memo(ProductImageView);

const styles = StyleSheet.create({
  frame: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
});
