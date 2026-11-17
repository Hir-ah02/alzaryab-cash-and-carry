import { useNavigate } from 'react-router';
import { useToast } from '../context/ToastContext';
import { createProduct } from '../services/productService';
import PageIntro from '../layout/PageIntro';
import ProductForm from '../components/ProductForm';

export default function AddProductPage() {
  const navigate = useNavigate();
  const toast = useToast();

  return (
    <>
      <PageIntro
        breadcrumb={[{ label: 'Products', to: '/products' }, { label: 'Add Product' }]}
        description="Add a new product to your inventory"
      />
      <ProductForm
        mode="create"
        onSubmit={createProduct}
        onSuccess={(product) => {
          toast.success('Product added successfully.', `"${product.name}" is now in your inventory.`);
          navigate('/products');
        }}
        onCancel={() => navigate('/products')}
      />
    </>
  );
}
