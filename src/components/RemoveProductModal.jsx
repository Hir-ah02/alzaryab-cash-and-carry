import { useState } from 'react';
import { useToast } from '../context/ToastContext';
import { removeProduct } from '../services/productService';
import ConfirmModal from './ConfirmModal';

/**
 * "Remove Product?" confirmation. Open it by passing a product;
 * close it with onClose. onRemoved runs after a successful soft delete.
 */
export default function RemoveProductModal({ product, onClose, onRemoved }) {
  const toast = useToast();
  const [loading, setLoading] = useState(false);

  const handleConfirm = async () => {
    setLoading(true);
    try {
      await removeProduct(product.id);
      toast.success('Product removed successfully.', `"${product.name}" is no longer in active inventory.`);
      onClose();
      onRemoved?.(product);
    } catch (err) {
      toast.error("Couldn't remove product", err.message || 'Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ConfirmModal
      open={Boolean(product)}
      title="Remove Product?"
      message={
        <>
          Are you sure you want to remove <strong>“{product?.name}”</strong>?
        </>
      }
      warning="It will no longer appear in active inventory."
      confirmLabel="Remove Product"
      loadingLabel="Removing…"
      loading={loading}
      onConfirm={handleConfirm}
      onCancel={onClose}
    />
  );
}
