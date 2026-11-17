import { Plus } from 'lucide-react';
import { Link } from 'react-router';

import type { CatalogProduct } from '@/api/types';
import { useCart } from '@/cart/CartProvider';
import { formatPrice } from '@/utils/format';

import { ProductImage } from './ProductImage';
import { QuantityStepper } from './QuantityStepper';
import { StockBadge } from './StockBadge';
import { useToast } from './Toast';
import { Button, cx } from './ui';

export function useAddToCart() {
  const cart = useCart();
  const toast = useToast();
  return (product: CatalogProduct, quantity = 1) => {
    const result = cart.add(product, quantity);
    if (result.ok) toast(result.capped ? `Added ${result.added} (limit 100 per item)` : `${product.name} added to cart`);
    else if (result.reason === 'outOfStock') toast(`${product.name} is out of stock`, 'error');
    else if (result.reason === 'limitReached') toast('You already have the maximum of 100 in your cart', 'error');
    return result;
  };
}

export function ProductCard({ product }: { product: CatalogProduct }) {
  const cart = useCart();
  const addToCart = useAddToCart();
  const inCart = cart.quantityOf(product.id);
  const href = `/products/${product.id}`;

  return (
    <article className="group flex flex-col overflow-hidden rounded-2xl border border-line bg-white transition-shadow hover:shadow-md" data-testid="product-card">
      <Link to={href} className="relative block aspect-square overflow-hidden bg-white p-3" tabIndex={-1} aria-hidden>
        <ProductImage src={product.image} alt="" className={cx('size-full transition-transform group-hover:scale-[1.03]', !product.inStock && 'opacity-50 grayscale')} />
        {product.stockStatus !== 'in' && <StockBadge status={product.stockStatus} className="absolute left-2 top-2" />}
      </Link>
      <div className="flex flex-1 flex-col gap-1 border-t border-line p-3">
        <p className="text-xs font-medium text-ink-3">{product.category}</p>
        <h3 className="line-clamp-2 text-sm font-semibold leading-snug">
          <Link to={href} className="hover:text-brand-700">
            {product.name}
          </Link>
        </h3>
        <p className="text-xs text-ink-2">{product.unit}</p>
        <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-2">
          <p className="text-base font-bold tabular-nums">{formatPrice(product.price)}</p>
          {!product.inStock ? (
            <span className="text-xs font-semibold text-danger">Out of stock</span>
          ) : inCart > 0 ? (
            <QuantityStepper size="sm" min={0} value={inCart} onChange={(q) => cart.setQuantity(product.id, q)} label={product.name} />
          ) : (
            <Button size="sm" icon={<Plus className="size-4" />} onClick={() => addToCart(product)} aria-label={`Add ${product.name} to cart`}>
              Add
            </Button>
          )}
        </div>
      </div>
    </article>
  );
}

export function ProductGrid({ products }: { products: CatalogProduct[] }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4 xl:grid-cols-5">
      {products.map((p) => (
        <ProductCard key={p.id} product={p} />
      ))}
    </div>
  );
}

export function ProductGridSkeleton({ count = 10 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4 xl:grid-cols-5" aria-hidden>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="overflow-hidden rounded-2xl border border-line bg-white">
          <div className="aspect-square animate-pulse bg-surface-muted" />
          <div className="space-y-2 p-3">
            <div className="h-3 w-1/3 animate-pulse rounded bg-line" />
            <div className="h-4 w-4/5 animate-pulse rounded bg-line" />
            <div className="h-4 w-1/2 animate-pulse rounded bg-line" />
          </div>
        </div>
      ))}
    </div>
  );
}

