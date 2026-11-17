import { createHashRouter, Navigate, RouterProvider } from 'react-router';
import AdminLayout from './layout/AdminLayout';
import ProtectedRoute from './components/ProtectedRoute';
import LoginPage from './pages/LoginPage';
import LogoutPage from './pages/LogoutPage';
import DashboardPage from './pages/DashboardPage';
import ProductsPage from './pages/ProductsPage';
import AddProductPage from './pages/AddProductPage';
import EditProductPage from './pages/EditProductPage';
import CategoriesPage from './pages/CategoriesPage';
import OrdersPage from './pages/OrdersPage';
import OrderDetailPage from './pages/OrderDetailPage';

/**
 * Hash-based routing (#/products) so the static build works on any host
 * without server rewrites. createHashRouter is the "data router" version
 * of <HashRouter>, which enables the unsaved-changes guard (useBlocker).
 * `handle.title` feeds the page title shown in the header.
 */
const router = createHashRouter([
  { path: '/login', element: <LoginPage />, handle: { title: 'Login' } },
  { path: '/logout', element: <LogoutPage /> },
  {
    path: '/',
    element: (
      <ProtectedRoute>
        <AdminLayout />
      </ProtectedRoute>
    ),
    children: [
      { index: true, element: <DashboardPage />, handle: { title: 'Dashboard' } },
      { path: 'products', element: <ProductsPage />, handle: { title: 'Products' } },
      { path: 'products/new', element: <AddProductPage />, handle: { title: 'Add Product' } },
      { path: 'products/:id/edit', element: <EditProductPage />, handle: { title: 'Edit Product' } },
      { path: 'categories', element: <CategoriesPage />, handle: { title: 'Categories' } },
      { path: 'orders', element: <OrdersPage />, handle: { title: 'Orders' } },
      { path: 'orders/:id', element: <OrderDetailPage />, handle: { title: 'Order Details' } },
    ],
  },
  { path: '*', element: <Navigate to="/" replace /> },
]);

export default function App() {
  return <RouterProvider router={router} />;
}
