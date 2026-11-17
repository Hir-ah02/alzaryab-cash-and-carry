import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { ArrowLeft, PackageSearch } from 'lucide-react';
import { useToast } from '../context/ToastContext';
import { getProduct, updateProduct } from '../services/productService';
import PageIntro from '../layout/PageIntro';
import EmptyState from '../components/EmptyState';
import ErrorState from '../components/ErrorState';
import ProductForm, { productToFormValues } from '../components/ProductForm';

function FormSkeleton() {
  return (
    <div className="form-grid" aria-busy="true" aria-label="Loading product">
      <div className="card card__body form-fields">
        {[0, 1, 2].map((i) => (
          <div key={i} className="form-fields" style={{ gap: 8 }}>
            <span className="skeleton skeleton--text" style={{ width: 120 }} />
            <span className="skeleton" style={{ height: 40, width: '100%' }} />
          </div>
        ))}
      </div>
      <div className="card card__body">
        <span className="skeleton" style={{ height: 260, width: '100%', borderRadius: 12 }} />
      </div>
    </div>
  );
}

export default function EditProductPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const [status, setStatus] = useState('loading'); // loading | ready | notFound | error
  const [product, setProduct] = useState(null);

  const load = useCallback(async () => {
    setStatus('loading');
    try {
      setProduct(await getProduct(id));
      setStatus('ready');
    } catch (err) {
      setStatus(err.status === 404 ? 'notFound' : 'error');
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <>
      <PageIntro
        breadcrumb={[{ label: 'Products', to: '/products' }, { label: 'Edit Product' }]}
        description={status === 'ready' ? `Update details for ${product.name}` : 'Update product details'}
      />

      {status === 'loading' && <FormSkeleton />}

      {status === 'error' && (
        <div className="card">
          <ErrorState title="Couldn't load product" onRetry={load} />
        </div>
      )}

      {status === 'notFound' && (
        <div className="card">
          <EmptyState
            icon={PackageSearch}
            title="Product not found"
            text="This product may have been removed or the link is incorrect."
            action={
              <Link to="/products" className="btn btn--secondary">
                <ArrowLeft size={18} aria-hidden="true" />
                <span>Back to Products</span>
              </Link>
            }
          />
        </div>
      )}

      {status === 'ready' && (
        <ProductForm
          key={product.id}
          mode="edit"
          initialValues={productToFormValues(product)}
          onSubmit={(data) => updateProduct(product.id, data)}
          onSuccess={(saved) => {
            toast.success('Product updated successfully.', `Changes to "${saved.name}" have been saved.`);
            navigate('/products');
          }}
          onCancel={() => navigate('/products')}
        />
      )}
    </>
  );
}
