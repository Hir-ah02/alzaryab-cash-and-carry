import { LayoutDashboard, Package, PackagePlus, ShoppingBag, Tags } from 'lucide-react';

/**
 * Sidebar navigation, built from data so new modules (e.g. Orders,
 * Customers) can be added later by appending a group or item here.
 * isActive decides highlighting, so /products/:id/edit keeps
 * "Products" active while /products/new highlights "Add Product".
 */
export const NAV_GROUPS = [
  {
    label: 'Inventory',
    items: [
      {
        to: '/',
        label: 'Dashboard',
        icon: LayoutDashboard,
        isActive: (path) => path === '/',
      },
      {
        to: '/products',
        label: 'Products',
        icon: Package,
        isActive: (path) => path === '/products' || /^\/products\/[^/]+\/edit\/?$/.test(path),
      },
      {
        to: '/products/new',
        label: 'Add Product',
        icon: PackagePlus,
        isActive: (path) => path === '/products/new',
      },
      {
        to: '/categories',
        label: 'Categories',
        icon: Tags,
        isActive: (path) => path === '/categories',
      },
    ],
  },
  {
    label: 'Sales',
    items: [
      {
        to: '/orders',
        label: 'Orders',
        icon: ShoppingBag,
        isActive: (path) => path === '/orders' || /^\/orders\/[^/]+\/?$/.test(path),
      },
    ],
  },
];
