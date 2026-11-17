import { Stack } from 'expo-router';

import { colors } from '@/theme';

/** Customer-only screens. The root layout guards this group: signed-out visitors are sent to /login. */
export default function CustomerLayout() {
  return (
    <Stack
      screenOptions={{
        headerTintColor: colors.primary,
        headerTitleStyle: { color: colors.text },
        headerShadowVisible: false,
        headerStyle: { backgroundColor: colors.background },
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="checkout" options={{ title: 'Checkout' }} />
      <Stack.Screen name="profile" options={{ title: 'Edit profile' }} />
      <Stack.Screen name="addresses/index" options={{ title: 'Delivery addresses' }} />
      <Stack.Screen name="addresses/new" options={{ title: 'New address' }} />
      <Stack.Screen name="addresses/[id]" options={{ title: 'Edit address' }} />
      <Stack.Screen name="orders/index" options={{ title: 'My orders' }} />
      <Stack.Screen name="orders/[id]" options={{ title: 'Order details' }} />
    </Stack>
  );
}
