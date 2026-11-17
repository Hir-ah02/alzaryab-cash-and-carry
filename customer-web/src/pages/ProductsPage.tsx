import { SearchX } from 'lucide-react';
import { Link, useSearchParams } from 'react-router';

import { CategoryIcon } from '@/components/CategoryIcon';
import { ProductGrid, ProductGridSkeleton } from '@/components/ProductCard';
import { Button, cx, EmptyState, ErrorState } from '@/components/ui';
import { useCategories, useProductPages } from '@/hooks/useCatalog';

export default function ProductsPage() {
  const [params] = useSearchParams();
  const search = (params.get('search') ?? '').slice(0, 100);
  const category = params.get('category') ?? '';
  const categories = useCategories();
  const products = useProductPages({ search, category }, { keepPrevious: true });

  const href = (q: string, cat: string) => {
    const next = new URLSearchParams();
    if (q) next.set('search', q);
    if (cat) next.set('category', cat);
    const qs = next.toString();
    return `/products${qs ? `?${qs}` : ''}`;
  };
  const hrefFor = (cat: string) => href(search, cat);

  const title = search ? `Results for “${search}”` : category || 'All products';
  const count = products.data?.count;

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
      <div className="lg:grid lg:grid-cols-[220px_1fr] lg:gap-8">
        <aside className="hidden lg:block" aria-label="Filter by category">
          <h2 className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-ink-3">Categories</h2>
          <nav className="flex flex-col gap-0.5">
            <Link to={hrefFor('')} className={cx('rounded-lg px-3 py-2 text-sm font-medium', !category ? 'bg-brand-50 text-brand-700' : 'text-ink-2 hover:bg-white')}>
              All categories
            </Link>
            {categories.data?.map((c) => {
              const active = category.toLowerCase() === c.name.toLowerCase();
              return (
                <Link key={c.id} to={hrefFor(c.name)} className={cx('flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium', active ? 'bg-brand-50 text-brand-700' : 'text-ink-2 hover:bg-white')}>
                  <CategoryIcon name={c.name} className="size-4" />
                  <span className="flex-1">{c.name}</span>
                  <span className="text-xs text-ink-3">{c.productCount}</span>
                </Link>
              );
            })}
          </nav>
        </aside>

        <section aria-live="polite">
          <div className="mb-5 flex flex-wrap items-baseline justify-between gap-2">
            <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
            {count !== undefined && (
              <p className="text-sm text-ink-2" data-testid="result-count">
                {count} {count === 1 ? 'product' : 'products'}
                {search && category ? ` in ${category}` : ''}
              </p>
            )}
          </div>
          {(search || category) && (
            <div className="mb-4 flex flex-wrap gap-2">
              {search && <Link to={href('', category)} className="rounded-full border border-line-strong bg-white px-3 py-1 text-xs font-medium hover:border-danger hover:text-danger">Search: {search} ✕</Link>}
              {category && <Link to={hrefFor('')} className="rounded-full border border-line-strong bg-white px-3 py-1 text-xs font-medium hover:border-danger hover:text-danger">{category} ✕</Link>}
            </div>
          )}

          {products.isError ? (
            <ErrorState error={products.error} onRetry={() => void products.refetch()} title="Couldn't load products" />
          ) : products.isPending ? (
            <ProductGridSkeleton />
          ) : products.data.products.length === 0 ? (
            <EmptyState
              icon={<SearchX className="size-7" />}
              title="No products found"
              text={search ? 'Try a different spelling or a shorter word.' : 'There are no products in this category right now.'}
              action={<Link to="/products" className="text-sm font-semibold text-brand-700 hover:underline">Browse all products</Link>}
            />
          ) : (
            <div className={cx(products.isPlaceholderData && 'opacity-60 transition-opacity')}>
              <ProductGrid products={products.data.products} />
              {products.hasNextPage && (
                <div className="mt-8 text-center">
                  <Button variant="secondary" onClick={() => void products.fetchNextPage()} loading={products.isFetchingNextPage}>
                    Load more products
                  </Button>
                </div>
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
