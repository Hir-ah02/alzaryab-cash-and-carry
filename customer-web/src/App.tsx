import { SearchX } from 'lucide-react';
import { lazy, Suspense, useEffect } from 'react';
import { createBrowserRouter, Outlet, RouterProvider, ScrollRestoration, useLocation } from 'react-router';

import { Footer } from '@/components/Footer';
import { Header } from '@/components/Header';
import { RequireAuth } from '@/components/RequireAuth';
import { ButtonLink, EmptyState, Spinner } from '@/components/ui';
import HomePage from '@/pages/HomePage';
import ProductPage from '@/pages/ProductPage';
import ProductsPage from '@/pages/ProductsPage';

// Shopping pages load with the site; account and checkout pages load on first visit.
const CartPage = lazy(() => import('@/pages/CartPage'));
const CheckoutPage = lazy(() => import('@/pages/CheckoutPage'));
const OrdersPage = lazy(() => import('@/pages/OrdersPage'));
const OrderDetailPage = lazy(() => import('@/pages/OrderDetailPage'));
const AccountPage = lazy(() => import('@/pages/AccountPage'));
const AddressesPage = lazy(() => import('@/pages/AddressesPage'));
const LoginPage = lazy(() => import('@/pages/AuthPages').then((m) => ({ default: m.LoginPage })));
const RegisterPage = lazy(() => import('@/pages/AuthPages').then((m) => ({ default: m.RegisterPage })));
const ForgotPasswordPage = lazy(() => import('@/pages/AuthPages').then((m) => ({ default: m.ForgotPasswordPage })));
const ResetPasswordPage = lazy(() => import('@/pages/AuthPages').then((m) => ({ default: m.ResetPasswordPage })));

const TITLES: [RegExp, string][] = [
  [/^\/$/, ''],
  [/^\/products\/\d+/, 'Product'],
  [/^\/products/, 'Shop'],
  [/^\/cart/, 'Cart'],
  [/^\/checkout/, 'Checkout'],
  [/^\/orders\/\d+/, 'Order'],
  [/^\/orders/, 'My orders'],
  [/^\/account\/addresses/, 'Addresses'],
  [/^\/account/, 'My account'],
  [/^\/login/, 'Sign in'],
  [/^\/register/, 'Create account'],
  [/^\/(forgot|reset)-password/, 'Reset password'],
];

function DocumentTitle() {
  const { pathname } = useLocation();
  useEffect(() => {
    const page = TITLES.find(([re]) => re.test(pathname))?.[1];
    document.title = page ? `${page} · Al Zaryab Cash & Carry` : 'Al Zaryab Cash & Carry · Groceries delivered';
  }, [pathname]);
  return null;
}

function Layout() {
  return (
    <div className="flex min-h-dvh flex-col">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-white focus:p-3">
        Skip to content
      </a>
      <Header />
      <main id="main" className="flex-1">
        <Suspense fallback={<Spinner />}>
          <Outlet />
        </Suspense>
      </main>
      <Footer />
      <ScrollRestoration />
      <DocumentTitle />
    </div>
  );
}

function NotFoundPage() {
  return <EmptyState icon={<SearchX className="size-7" />} title="Page not found" text="The page you're looking for doesn't exist." action={<ButtonLink to="/">Go to the homepage</ButtonLink>} />;
}

const auth = (el: React.ReactNode) => <RequireAuth>{el}</RequireAuth>;

const router = createBrowserRouter([
  {
    element: <Layout />,
    children: [
      { path: '/', element: <HomePage /> },
      { path: '/products', element: <ProductsPage /> },
      { path: '/products/:id', element: <ProductPage /> },
      { path: '/cart', element: <CartPage /> },
      { path: '/checkout', element: auth(<CheckoutPage />) },
      { path: '/orders', element: auth(<OrdersPage />) },
      { path: '/orders/:id', element: auth(<OrderDetailPage />) },
      { path: '/account', element: auth(<AccountPage />) },
      { path: '/account/addresses', element: auth(<AddressesPage />) },
      { path: '/login', element: <LoginPage /> },
      { path: '/register', element: <RegisterPage /> },
      { path: '/forgot-password', element: <ForgotPasswordPage /> },
      { path: '/reset-password', element: <ResetPasswordPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]);

export default function App() {
  return <RouterProvider router={router} />;
}
