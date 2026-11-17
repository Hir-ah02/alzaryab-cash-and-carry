import { QueryClientProvider } from '@tanstack/react-query';
import { router, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';

import { AuthProvider, useAuth } from '@/auth/AuthProvider';
import { takeReturnTo } from '@/auth/returnTo';
import { CartProvider } from '@/cart/CartProvider';
import { connectAppFocus, createQueryClient } from '@/lib/queryClient';
import { colors } from '@/theme';

/**
 * Navigation map (see README "Navigation"):
 *   (tabs)            Home · Categories · Cart · Account
 *   product/[id]      Product details
 *   category/[name]   Products in a category
 *   search            Product search
 *   login, register,
 *   forgot-password,
 *   reset-password    Only while signed out
 *   (customer)/…      Checkout, addresses, orders, profile: signed-in customers only
 */
function RootNavigator() {
  const { status } = useAuth();

  // After signing in, the guard closes the sign-in screen; then continue to where the
  // customer was heading (e.g. Checkout), if a screen asked for that.
  useEffect(() => {
    if (status !== 'signedIn') return;
    const target = takeReturnTo();
    if (!target) return;
    // Wait for the guard to finish closing the sign-in screen, or it would undo this navigation.
    const timer = setTimeout(() => router.push(target), 0);
    return () => clearTimeout(timer);
  }, [status]);

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
      <Stack.Screen name="(tabs)" options={{ headerShown: false, title: 'Home' }} />
      <Stack.Screen name="product/[id]" options={{ title: '' }} />
      <Stack.Screen name="category/[name]" options={{ title: 'Category' }} />
      <Stack.Screen name="search" options={{ title: 'Search' }} />

      <Stack.Protected guard={status !== 'signedIn'}>
        <Stack.Screen name="login" options={{ title: 'Sign in' }} />
        <Stack.Screen name="register" options={{ title: 'Create account' }} />
        <Stack.Screen name="forgot-password" options={{ title: 'Reset password' }} />
        <Stack.Screen name="reset-password" options={{ title: 'Reset password' }} />
      </Stack.Protected>

      {/* While the saved session is being restored the guard stays open, so deep links aren't bounced too early. */}
      <Stack.Protected guard={status !== 'signedOut'} redirectTo="/login">
        <Stack.Screen name="(customer)" options={{ headerShown: false }} />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  const [queryClient] = useState(createQueryClient);
  useEffect(connectAppFocus, []);

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <CartProvider>
          <StatusBar style="dark" />
          <RootNavigator />
        </CartProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
