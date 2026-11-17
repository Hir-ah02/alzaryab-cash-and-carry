import { ChevronRight, PackageX, ShoppingCart } from 'lucide-react';
import { useState } from 'react';
import { Link, useParams } from 'react-router';

import { ApiError } from '@/api/errors';
import { useCart } from '@/cart/CartProvider';
import { MAX_QUANTITY_PER_ITEM } from '@/cart/cartReducer';
import { useAddToCart } from '@/components/ProductCard';
import { ProductImage } from '@/components/ProductImage';
import { QuantityStepper } from '@/components/QuantityStepper';
import { StockBadge } from '@/components/StockBadge';
import { Button, ButtonLink, EmptyState, ErrorState, Spinner } from '@/components/ui';
import { useProduct } from '@/hooks/useCatalog';
import { formatPrice } from '@/utils/format';

export default function ProductPage() {
  const { id } = useParams();
  const validId = !!id && /^\d+$/.test(id);
  const product = useProduct(validId ? id : undefined);
  const cart = useCart();
  const addToCart = useAddToCart();
  const [quantity, setQuantity] = useState(1);

  if (!validId || (product.error instanceof ApiError && product.error.status === 404)) {
    return (
      <EmptyState
        icon={<PackageX className="size-7" />}
        title="Product not available"
        text="This product isn't on sale right now. It may have been removed or sold out."
        action={<ButtonLink to="/products">Browse products</ButtonLink>}
      />
    );
  }
  if (product.isError) return <ErrorState error={product.error} onRetry={() => void product.refetch()} />;
  if (product.isPending) return <Spinner label="Loading product…" />;

  const p = product.data;
  const inCart = cart.quantityOf(p.id);
  const room = MAX_QUANTITY_PER_ITEM - inCart;

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
      <nav aria-label="Breadcrumb" className="mb-5 flex flex-wrap items-center gap-1 text-sm text-ink-2">
        <Link to="/" className="hover:text-brand-700">Home</Link>
        <ChevronRight className="size-4" aria-hidden />
        <Link to={`/products?category=${encodeURIComponent(p.category)}`} className="hover:text-brand-700">{p.category}</Link>
        <ChevronRight className="size-4" aria-hidden />
        <span className="truncate text-ink" aria-current="page">{p.name}</span>
      </nav>

      <div className="grid gap-6 rounded-2xl border border-line bg-white p-4 sm:p-6 md:grid-cols-2 md:gap-10">
        <div className="aspect-square overflow-hidden rounded-xl bg-white">
          <ProductImage src={p.image} alt={p.name} className="size-full" eager />
        </div>

        <div className="flex flex-col">
          <Link to={`/products?category=${encodeURIComponent(p.category)}`} className="text-sm font-semibold text-brand-700 hover:underline">{p.category}</Link>
          <h1 className="mt-1 text-2xl font-bold leading-tight tracking-tight sm:text-3xl">{p.name}</h1>
          <p className="mt-1 text-ink-2">{p.unit}</p>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <p className="text-3xl font-extrabold tabular-nums" data-testid="product-price">{formatPrice(p.price)}</p>
            <StockBadge status={p.stockStatus} />
          </div>

          {p.description && <p className="mt-5 whitespace-pre-line leading-relaxed text-ink-2">{p.description}</p>}

          <div className="mt-6 border-t border-line pt-6">
            {p.inStock ? (
              <>
                <div className="flex flex-wrap items-center gap-3">
                  <QuantityStepper value={Math.min(quantity, Math.max(room, 1))} onChange={setQuantity} max={Math.max(room, 1)} label={p.name} disabled={room <= 0} />
                  <Button
                    size="lg"
                    icon={<ShoppingCart className="size-5" />}
                    disabled={room <= 0}
                    onClick={() => {
                      const result = addToCart(p, Math.min(quantity, room));
                      if (result.ok) setQuantity(1);
                    }}
                    className="flex-1 sm:flex-none"
                  >
                    Add to cart
                  </Button>
                </div>
                {p.stockStatus === 'low' && <p className="mt-3 text-sm font-medium text-gold-800">Only a few left. Order soon.</p>}
                {inCart > 0 && (
                  <p className="mt-3 text-sm text-ink-2" data-testid="in-cart">
                    {inCart} in your cart · <Link to="/cart" className="font-semibold text-brand-700 hover:underline">View cart</Link>
                  </p>
                )}
                {room <= 0 && <p className="mt-2 text-sm text-danger">You have the maximum of {MAX_QUANTITY_PER_ITEM} in your cart.</p>}
              </>
            ) : (
              <div className="rounded-xl bg-danger-bg p-4 text-sm text-danger">
                <p className="font-semibold">Out of stock</p>
                <p>This product can't be ordered right now. Please check back later.</p>
              </div>
            )}
            <p className="mt-4 text-xs text-ink-3">Prices and availability are confirmed when you place your order.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
