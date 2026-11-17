/**
 * Shapes returned by the Django API (the serializers in backend/apps/ and
 * backend/apps/catalog/public.py). "Api*" types are the raw JSON; the
 * unprefixed types are what the app uses after parsing (money as numbers).
 */

/** DRF page: GET list endpoints with ?page=&page_size= (max 100). */
export interface Paginated<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export type StockStatus = 'in' | 'low' | 'out';

// ---------- Catalogue (public, read-only) ----------

/** GET /api/catalog/products/ and /api/catalog/products/{id}/ */
export interface ApiCatalogProduct {
  id: number;
  name: string;
  category: string;
  categoryId: number;
  description: string;
  unit: string;
  price: string; // decimal string, e.g. "320.00"
  image: string | null; // absolute URL
  stockStatus: StockStatus;
  inStock: boolean;
}

export interface CatalogProduct extends Omit<ApiCatalogProduct, 'price'> {
  price: number;
}

/** GET /api/catalog/categories/ (not paginated) */
export interface CatalogCategory {
  id: number;
  name: string;
  description: string;
  productCount: number;
}

// ---------- Customer account ----------

/** GET/PATCH /api/customer/profile/ and the `user` in auth responses */
export interface Customer {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  name: string;
  phone: string;
  dateJoined: string;
}

/** POST /api/customer/auth/login/ and /register/ */
export interface AuthResponse {
  access: string;
  refresh: string;
  user: Customer;
}

/** POST /api/customer/auth/refresh/ (the old refresh token is revoked) */
export interface TokenPair {
  access: string;
  refresh: string;
}

export interface RegisterInput {
  email: string;
  password: string;
  firstName: string;
  lastName?: string;
  phone?: string;
}

/** /api/customer/addresses/ (not paginated, max 10) */
export interface Address {
  id: number;
  label: string;
  recipientName: string;
  phone: string;
  line1: string;
  line2: string;
  area: string;
  city: string;
  postalCode: string;
  instructions: string;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export type AddressInput = Omit<Address, 'id' | 'createdAt' | 'updatedAt' | 'isDefault'> & { isDefault?: boolean };

// ---------- Orders ----------

export type OrderStatus = 'pending' | 'confirmed' | 'preparing' | 'out_for_delivery' | 'delivered' | 'cancelled';
export type PaymentMethod = 'cash_on_delivery';
export type PaymentStatus = 'unpaid' | 'paid' | 'void';

/** One row of GET /api/customer/orders/ */
export interface ApiOrderSummary {
  id: number;
  reference: string;
  status: OrderStatus;
  statusLabel: string;
  itemCount: number;
  subtotal: string;
  deliveryFee: string;
  total: string;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  createdAt: string;
  updatedAt: string;
}

export interface ApiOrderItem {
  id: number;
  productId: number;
  productName: string;
  unit: string;
  unitPrice: string;
  quantity: number;
  lineTotal: string;
}

export interface OrderDelivery {
  name: string;
  phone: string;
  line1: string;
  line2: string;
  area: string;
  city: string;
  postalCode: string;
  instructions: string;
}

export interface OrderHistoryEntry {
  fromStatus: OrderStatus | '';
  toStatus: OrderStatus;
  note: string;
  changedBy: 'You' | 'Store' | null;
  createdAt: string;
}

/** GET /api/customer/orders/{id}/, POST (place) and POST …/cancel/ */
export interface ApiOrderDetail extends ApiOrderSummary {
  items: ApiOrderItem[];
  delivery: OrderDelivery;
  customerNote: string;
  cancelReason: string;
  history: OrderHistoryEntry[];
  canCancel: boolean;
}

export interface OrderSummary extends Omit<ApiOrderSummary, 'subtotal' | 'deliveryFee' | 'total'> {
  subtotal: number;
  deliveryFee: number;
  total: number;
}

export interface OrderItem extends Omit<ApiOrderItem, 'unitPrice' | 'lineTotal'> {
  unitPrice: number;
  lineTotal: number;
}

export interface OrderDetail extends Omit<ApiOrderDetail, 'subtotal' | 'deliveryFee' | 'total' | 'items'> {
  subtotal: number;
  deliveryFee: number;
  total: number;
  items: OrderItem[];
}

/** POST /api/customer/orders/. Prices and totals are never sent; the server calculates them. */
export interface PlaceOrderInput {
  items: OrderLine[];
  addressId: number;
  paymentMethod?: PaymentMethod;
  note?: string;
  /** New random UUID per checkout; resending it returns the same order instead of a duplicate. */
  requestId: string;
}

/** One line of POST /api/customer/orders/quote/ (priced by the server). */
export interface ApiQuoteItem {
  productId: number;
  productName: string;
  unit: string;
  unitPrice: string;
  quantity: number;
  lineTotal: string;
}

/** POST /api/customer/orders/quote/  What these items cost right now; nothing is reserved or saved. */
export interface ApiOrderQuote {
  items: ApiQuoteItem[];
  subtotal: string;
  deliveryFee: string;
  total: string;
  /** Subtotal from which delivery is free, or null when there is no free-delivery offer. */
  freeDeliveryFrom: string | null;
}

export interface QuoteItem extends Omit<ApiQuoteItem, 'unitPrice' | 'lineTotal'> {
  unitPrice: number;
  lineTotal: number;
}

export interface OrderQuote {
  items: QuoteItem[];
  subtotal: number;
  deliveryFee: number;
  total: number;
  freeDeliveryFrom: number | null;
}

export type OrderLine = { productId: number; quantity: number };

/** One entry of `items` in a 400 response when an order can't be placed. */
export interface OrderProblem {
  productId: number;
  message: string;
  available?: number;
}
