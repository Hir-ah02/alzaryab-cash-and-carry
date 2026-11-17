import { ArrowRight, Banknote, Truck } from 'lucide-react';
import { Link } from 'react-router';

import { CategoryIcon } from '@/components/CategoryIcon';
import { ProductGrid, ProductGridSkeleton } from '@/components/ProductCard';
import { SearchBox } from '@/components/SearchBox';
import { ButtonLink, EmptyState, ErrorState } from '@/components/ui';
import { useCategories, useProductPages } from '@/hooks/useCatalog';

export default function HomePage() {
  const categories = useCategories();
  const products = useProductPages({});
  const list = products.data?.products ?? [];

  return (
    <>
      <section className="bg-gradient-to-br from-brand-700 to-brand-600 text-white">
        <div className="mx-auto grid max-w-7xl items-center gap-8 px-4 py-10 sm:px-6 sm:py-14 lg:grid-cols-[1.3fr_1fr]">
          <div>
            <p className="mb-3 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-gold-400">
              <Banknote className="size-4" aria-hidden /> Cash on Delivery
            </p>
            <h1 className="text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl lg:text-5xl">
              Your groceries,
              <br />
              delivered by <span className="text-gold-400">Al Zaryab</span>
            </h1>
            <p className="mt-3 max-w-lg text-base text-white/85 sm:text-lg">
              Shop everyday essentials at cash &amp; carry prices. Order online and pay when it arrives.
            </p>
            <div className="mt-6 hidden max-w-xl rounded-2xl bg-white p-1.5 text-ink shadow-lg md:block">
              <SearchBox />
            </div>
          </div>
          <div className="hidden grid-cols-2 gap-3 lg:grid">
            {[
              { icon: Truck, title: 'Doorstep delivery', text: 'Straight from our store' },
              { icon: Banknote, title: 'Pay on delivery', text: 'No card needed' },
            ].map(({ icon: Icon, title, text }) => (
              <div key={title} className="rounded-2xl bg-white/10 p-5 backdrop-blur">
                <Icon className="mb-3 size-8 text-gold-400" aria-hidden />
                <p className="font-semibold">{title}</p>
                <p className="text-sm text-white/75">{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <section className="py-8 sm:py-10" aria-labelledby="categories-heading">
          <div className="mb-4 flex items-end justify-between">
            <h2 id="categories-heading" className="text-xl font-bold tracking-tight sm:text-2xl">Shop by category</h2>
          </div>
          {categories.isError ? (
            <ErrorState error={categories.error} onRetry={() => void categories.refetch()} title="Couldn't load categories" />
          ) : categories.isPending ? (
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
              {Array.from({ length: 6 }, (_, i) => <div key={i} className="h-28 animate-pulse rounded-2xl bg-white" />)}
            </div>
          ) : categories.data.length === 0 ? (
            <p className="text-sm text-ink-2">Categories will appear here as soon as products are added.</p>
          ) : (
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
              {categories.data.map((c) => (
                <Link
                  key={c.id}
                  to={`/products?category=${encodeURIComponent(c.name)}`}
                  className="group flex flex-col items-center gap-2 rounded-2xl border border-line bg-white p-4 text-center transition-all hover:-translate-y-0.5 hover:border-brand-600 hover:shadow-md"
                >
                  <span className="flex size-12 items-center justify-center rounded-full bg-brand-50 text-brand-600 transition-colors group-hover:bg-brand-600 group-hover:text-white">
                    <CategoryIcon name={c.name} className="size-6" />
                  </span>
                  <span className="text-sm font-semibold leading-tight">{c.name}</span>
                  <span className="text-xs text-ink-3">{c.productCount} {c.productCount === 1 ? 'item' : 'items'}</span>
                </Link>
              ))}
            </div>
          )}
        </section>

        <section aria-labelledby="products-heading">
          <div className="mb-4 flex items-end justify-between gap-3">
            <h2 id="products-heading" className="text-xl font-bold tracking-tight sm:text-2xl">Products</h2>
            <Link to="/products" className="inline-flex items-center gap-1 text-sm font-semibold text-brand-700 hover:underline">
              View all <ArrowRight className="size-4" aria-hidden />
            </Link>
          </div>
          {products.isError ? (
            <ErrorState error={products.error} onRetry={() => void products.refetch()} title="Couldn't load products" />
          ) : products.isPending ? (
            <ProductGridSkeleton />
          ) : list.length === 0 ? (
            <EmptyState icon={<Truck className="size-7" />} title="No products yet" text="Our shelves are being stocked. Please check back soon." />
          ) : (
            <>
              <ProductGrid products={list.slice(0, 10)} />
              {products.data.count > 10 && (
                <div className="mt-6 text-center">
                  <ButtonLink to="/products" variant="secondary">See all {products.data.count} products</ButtonLink>
                </div>
              )}
            </>
          )}
        </section>
      </div>
    </>
  );
}
