import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router';
import { ArrowRight, CircleCheck, CircleX, Package, Pencil, Plus, Trash2, TriangleAlert } from 'lucide-react';
import { listProducts, summarize } from '../services/productService';
import { STOCK_STATUS } from '../utils/stock';
import { formatPrice } from '../utils/format';
import PageIntro from '../layout/PageIntro';
import Button from '../components/Button';
import EmptyState from '../components/EmptyState';
import ErrorState from '../components/ErrorState';
import IconButton from '../components/IconButton';
import ProductThumb from '../components/ProductThumb';
import RemoveProductModal from '../components/RemoveProductModal';
import SkeletonRows from '../components/SkeletonRows';
import StatusBadge from '../components/StatusBadge';
import StockValue from '../components/StockValue';
import SummaryCard from '../components/SummaryCard';

const SKELETON_COLUMNS = ['product', 'text', 'num', 'text', 'num', 'pill', 'actions'];

export default function DashboardPage() {
  const [status, setStatus] = useState('loading'); // loading | ready | error
  const [summary, setSummary] = useState(null);
  const [lowStock, setLowStock] = useState([]);
  const [removing, setRemoving] = useState(null);

  const load = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setStatus('loading');
    try {
      // Up to 100 low-stock products (the API's largest page); the card shows the full count.
      const [counts, low] = await Promise.all([summarize(), listProducts({ stock: STOCK_STATUS.LOW, pageSize: 100 })]);
      setSummary(counts);
      setLowStock([...low.items].sort((a, b) => a.stock - b.stock || a.name.localeCompare(b.name)));
      setStatus('ready');
    } catch {
      setStatus('error');
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const loading = status === 'loading';

  return (
    <>
      <PageIntro
        description="Overview of your store inventory"
        action={
          <Link to="/products/new" className="btn btn--primary">
            <Plus size={18} aria-hidden="true" />
            <span>Add Product</span>
          </Link>
        }
      />

      {status === 'error' ? (
        <div className="card">
          <ErrorState
            title="Couldn't load dashboard"
            text="We couldn't load your inventory summary. Check your connection and try again."
            onRetry={() => load()}
          />
        </div>
      ) : (
        <>
          <section className="summary-grid" aria-label="Inventory summary">
            <SummaryCard
              label="Total Products"
              value={summary?.total ?? 0}
              hint="Active products in inventory"
              icon={Package}
              loading={loading}
            />
            <SummaryCard
              label="Low Stock"
              value={summary?.lowStock ?? 0}
              hint="Products with 1–5 units left"
              icon={TriangleAlert}
              tone="warning"
              to="/products?stock=low&status=active"
              linkLabel="View low stock"
              loading={loading}
            />
            <SummaryCard
              label="Out of Stock"
              value={summary?.outOfStock ?? 0}
              hint="Need restocking now"
              icon={CircleX}
              tone="error"
              to="/products?stock=out&status=active"
              linkLabel="View out of stock"
              loading={loading}
            />
          </section>

          <section className="card" aria-labelledby="low-stock-title">
            <div className="card__header">
              <h2 id="low-stock-title" className="card__title">
                Low Stock Products
                {!loading && (
                  <span className="count-badge" aria-label={`${lowStock.length} products`}>
                    {lowStock.length}
                  </span>
                )}
              </h2>
              <Link to="/products" className="btn btn--tertiary btn--sm">
                <span>View All Products</span>
                <ArrowRight size={16} aria-hidden="true" />
              </Link>
            </div>

            {!loading && lowStock.length === 0 ? (
              <EmptyState
                compact
                tone="success"
                icon={CircleCheck}
                title="Everything is well stocked"
                text="No products are running low right now. Nice work!"
              />
            ) : (
              <div className="table-scroll">
                <table className="table" aria-busy={loading || undefined}>
                  <caption className="sr-only">Products with 1 to 5 units left</caption>
                  <thead>
                    <tr>
                      <th scope="col">Product</th>
                      <th scope="col">Category</th>
                      <th scope="col" className="num">Stock</th>
                      <th scope="col">Unit</th>
                      <th scope="col" className="num">Price</th>
                      <th scope="col">Status</th>
                      <th scope="col" className="num">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <SkeletonRows columns={SKELETON_COLUMNS} rows={5} />
                    ) : (
                      lowStock.map((p) => (
                        <tr key={p.id}>
                          <td>
                            <div className="table__product">
                              <ProductThumb src={p.image} />
                              <span className="table__name">{p.name}</span>
                            </div>
                          </td>
                          <td className="muted">{p.category}</td>
                          <td className="num">
                            <StockValue stock={p.stock} />
                          </td>
                          <td className="muted">{p.unit}</td>
                          <td className="num">{formatPrice(p.price)}</td>
                          <td>
                            <StatusBadge stock={p.stock} />
                          </td>
                          <td>
                            <div className="row-actions">
                              <IconButton icon={Pencil} variant="edit" label={`Edit ${p.name}`} to={`/products/${p.id}/edit`} />
                              <IconButton icon={Trash2} variant="delete" label={`Remove ${p.name}`} onClick={() => setRemoving(p)} />
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}

      <RemoveProductModal
        product={removing}
        onClose={() => setRemoving(null)}
        onRemoved={() => load({ silent: true })}
      />
    </>
  );
}
