import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { FilterX, Package, Pencil, Plus, SearchX, Trash2 } from 'lucide-react';
import { listProducts } from '../services/productService';
import { isValidStockFilter, STOCK_FILTER_OPTIONS } from '../utils/stock';
import { formatPrice } from '../utils/format';
import { useDebouncedValue } from '../utils/hooks';
import { useCategories } from '../utils/useCategories';
import PageIntro from '../layout/PageIntro';
import Button from '../components/Button';
import EmptyState from '../components/EmptyState';
import ErrorState from '../components/ErrorState';
import IconButton from '../components/IconButton';
import Pagination from '../components/Pagination';
import ProductThumb from '../components/ProductThumb';
import RemoveProductModal from '../components/RemoveProductModal';
import SearchInput from '../components/SearchInput';
import Select from '../components/Select';
import SkeletonRows from '../components/SkeletonRows';
import StatusBadge from '../components/StatusBadge';
import StockValue from '../components/StockValue';

const PAGE_SIZE = 10;

// ?status= in the page URL → the API's ?active= filter. No status shows every product, active or removed.
const PRODUCT_STATUS_FILTER_OPTIONS = [
  { value: '', label: 'All Products' },
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
];
const ACTIVE_FILTER_FOR_STATUS = { '': 'all', active: 'true', inactive: 'false' };
const SKELETON_COLUMNS = ['thumb', 'name', 'text', 'text', 'num', 'num', 'pill', 'actions'];

function AddProductLink() {
  return (
    <Link to="/products/new" className="btn btn--primary">
      <Plus size={18} aria-hidden="true" />
      <span>Add Product</span>
    </Link>
  );
}

export default function ProductsPage() {
  // Filters live in the URL (?q=&category=&stock=&status=&page=) so they survive
  // refreshes, can be shared, and work with the browser back button.
  const [params, setParams] = useSearchParams();
  const categories = useCategories();
  const categoryOptions = [{ value: '', label: 'All Categories' }, ...categories.map((c) => ({ value: c, label: c }))];
  const search = params.get('q') ?? '';
  // Until the category list arrives, trust the link; afterwards ignore unknown names.
  const requestedCategory = params.get('category') ?? '';
  const category = categories.length === 0 || categories.includes(requestedCategory) ? requestedCategory : '';
  const stock = isValidStockFilter(params.get('stock')) ? params.get('stock') : '';
  const productStatus = Object.hasOwn(ACTIVE_FILTER_FOR_STATUS, params.get('status') ?? '') ? params.get('status') ?? '' : '';
  const requestedPage = Math.max(1, Number.parseInt(params.get('page'), 10) || 1);

  const debouncedSearch = useDebouncedValue(search, 250);
  const [status, setStatus] = useState('loading'); // loading | refreshing | ready | error
  const [products, setProducts] = useState([]);
  const [total, setTotal] = useState(0);
  const [reloadKey, setReloadKey] = useState(0);
  const [removing, setRemoving] = useState(null);
  const cardRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    setStatus((s) => (s === 'ready' || s === 'refreshing' ? 'refreshing' : 'loading'));
    // Search, filters and paging all run on the server.
    listProducts({
      search: debouncedSearch,
      category,
      stock,
      active: ACTIVE_FILTER_FOR_STATUS[productStatus],
      page: requestedPage,
      pageSize: PAGE_SIZE,
    })
      .then(({ items, total: count }) => {
        if (cancelled) return;
        setProducts(items);
        setTotal(count);
        setStatus('ready');
      })
      .catch((err) => {
        if (cancelled) return;
        if (err.status === 404 && requestedPage > 1) {
          // Past the last page (e.g. after removing its only product): go back to page 1.
          setParams(
            (prev) => {
              const next = new URLSearchParams(prev);
              next.delete('page');
              return next;
            },
            { replace: true },
          );
          return;
        }
        setStatus('error');
      });
    return () => {
      cancelled = true;
    };
  }, [debouncedSearch, category, stock, productStatus, requestedPage, reloadKey, setParams]);

  const updateParams = (changes, { replace = false } = {}) => {
    const next = new URLSearchParams(params);
    Object.entries(changes).forEach(([key, value]) => {
      if (value) next.set(key, value);
      else next.delete(key);
    });
    if (!('page' in changes)) next.delete('page');
    setParams(next, { replace });
  };

  const hasFilters = Boolean(search || category || stock || productStatus);
  const clearFilters = () => setParams({});
  const reload = () => setReloadKey((k) => k + 1);

  const page = requestedPage;
  const pageItems = products;

  const goToPage = (p) => {
    updateParams({ page: p > 1 ? String(p) : '' });
    cardRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' });
  };

  const isLoading = status === 'loading';
  const isEmpty = (status === 'ready' || status === 'refreshing') && total === 0;

  let body;
  if (status === 'error') {
    body = <ErrorState onRetry={reload} />;
  } else if (isEmpty && !hasFilters) {
    body = (
      <EmptyState
        icon={Package}
        title="No products found"
        text="Start by adding your first product."
        action={<AddProductLink />}
      />
    );
  } else if (isEmpty) {
    body = (
      <EmptyState
        icon={SearchX}
        title="No products match your search"
        text="Try a different name, or clear the filters to see all products."
        action={
          <Button variant="secondary" leadingIcon={FilterX} onClick={clearFilters}>
            Clear filters
          </Button>
        }
      />
    );
  } else {
    body = (
      <>
        <div className="table-scroll">
          <table className="table" aria-busy={status !== 'ready' || undefined}>
            <caption className="sr-only">Products</caption>
            <thead>
              <tr>
                <th scope="col">Image</th>
                <th scope="col">Product</th>
                <th scope="col">Category</th>
                <th scope="col">Unit</th>
                <th scope="col" className="num">Price</th>
                <th scope="col" className="num">Stock</th>
                <th scope="col">Status</th>
                <th scope="col" className="num">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <SkeletonRows columns={SKELETON_COLUMNS} rows={8} />
              ) : (
                pageItems.map((p) => (
                  <tr key={p.id} className={p.active === false ? 'table__row--inactive' : undefined}>
                    <td>
                      <ProductThumb src={p.image} />
                    </td>
                    <td>
                      <span className="table__name">{p.name}</span>
                      {p.active === false ? (
                        <span
                          className="pill pill--muted pill--inactive"
                          title="Removed from inventory: not shown to customers or counted on the dashboard"
                        >
                          Inactive
                        </span>
                      ) : (
                        p.isAvailable === false && (
                          <span className="pill pill--muted" title="Hidden from customers">
                            Hidden
                          </span>
                        )
                      )}
                    </td>
                    <td className="muted">{p.category}</td>
                    <td className="muted">{p.unit}</td>
                    <td className="num">{formatPrice(p.price)}</td>
                    <td className="num">
                      <StockValue stock={p.stock} />
                    </td>
                    <td>
                      <StatusBadge stock={p.stock} />
                    </td>
                    <td className="col-actions">
                      {p.active === false ? (
                        <span className="muted" title="Removed products can't be edited or removed again">
                          Removed
                        </span>
                      ) : (
                        <div className="row-actions row-actions--subtle">
                          <IconButton icon={Pencil} variant="edit" label={`Edit ${p.name}`} to={`/products/${p.id}/edit`} />
                          <IconButton icon={Trash2} variant="delete" label={`Remove ${p.name}`} onClick={() => setRemoving(p)} />
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {!isLoading && (
          <Pagination page={page} pageSize={PAGE_SIZE} total={total} onPageChange={goToPage} />
        )}
      </>
    );
  }

  return (
    <>
      <PageIntro description="Manage your store inventory" action={<AddProductLink />} />

      <section className="card" ref={cardRef} aria-label="Product inventory" style={{ scrollMarginTop: 88 }}>
        <div className="toolbar" role="search">
          <SearchInput
            id="product-search"
            label="Search products"
            placeholder="Search products..."
            className="toolbar__search"
            value={search}
            onChange={(e) => updateParams({ q: e.target.value }, { replace: true })}
            onClear={() => updateParams({ q: '' }, { replace: true })}
          />
          <div className="toolbar__filters">
            <Select
              id="filter-category"
              label="Category"
              hideLabel
              options={categoryOptions}
              value={category}
              onChange={(e) => updateParams({ category: e.target.value })}
            />
            <Select
              id="filter-stock"
              label="Stock status"
              hideLabel
              options={STOCK_FILTER_OPTIONS}
              value={stock}
              onChange={(e) => updateParams({ stock: e.target.value })}
            />
            <Select
              id="filter-product-status"
              label="Product status"
              hideLabel
              options={PRODUCT_STATUS_FILTER_OPTIONS}
              value={productStatus}
              onChange={(e) => updateParams({ status: e.target.value })}
            />
          </div>
        </div>

        {body}

        <p className="sr-only" aria-live="polite">
          {status === 'ready' ? `${total} ${total === 1 ? 'product' : 'products'} found` : ''}
        </p>
      </section>

      <RemoveProductModal product={removing} onClose={() => setRemoving(null)} onRemoved={reload} />
    </>
  );
}
