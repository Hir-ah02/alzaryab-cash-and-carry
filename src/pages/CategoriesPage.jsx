import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router';
import { Check, Pencil, Plus, RotateCcw, Tags, X, EyeOff } from 'lucide-react';
import { useToast } from '../context/ToastContext';
import {
  createCategory,
  deactivateCategory,
  listAllCategories,
  reactivateCategory,
  updateCategory,
} from '../services/categoryService';
import { refreshCategories } from '../utils/useCategories';
import PageIntro from '../layout/PageIntro';
import Button from '../components/Button';
import ConfirmModal from '../components/ConfirmModal';
import EmptyState from '../components/EmptyState';
import ErrorState from '../components/ErrorState';
import IconButton from '../components/IconButton';
import SkeletonRows from '../components/SkeletonRows';
import TextField from '../components/TextField';

const SKELETON_COLUMNS = ['name', 'num', 'pill', 'actions'];

export default function CategoriesPage() {
  const toast = useToast();
  const [status, setStatus] = useState('loading'); // loading | ready | error
  const [categories, setCategories] = useState([]);
  const [newName, setNewName] = useState('');
  const [newError, setNewError] = useState('');
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState(null); // { id, name, error }
  const [savingId, setSavingId] = useState(null);
  const [deactivating, setDeactivating] = useState(null);

  const load = useCallback(async () => {
    try {
      setCategories(await listAllCategories());
      setStatus('ready');
    } catch {
      setStatus('error');
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Reload this list and the dropdowns elsewhere in the portal.
  const afterChange = async () => {
    await load();
    refreshCategories();
  };

  const handleAdd = async (e) => {
    e.preventDefault();
    if (adding) return;
    if (!newName.trim()) {
      setNewError('Category name is required.');
      return;
    }
    setAdding(true);
    try {
      const created = await createCategory({ name: newName });
      toast.success('Category added.', `"${created.name}" can now be used for products.`);
      setNewName('');
      setNewError('');
      await afterChange();
    } catch (err) {
      setNewError(err.fields?.name || err.message);
    } finally {
      setAdding(false);
    }
  };

  const saveRename = async () => {
    if (!editing.name.trim()) {
      setEditing({ ...editing, error: 'Category name is required.' });
      return;
    }
    setSavingId(editing.id);
    try {
      await updateCategory(editing.id, { name: editing.name });
      toast.success('Category renamed.');
      setEditing(null);
      await afterChange();
    } catch (err) {
      setEditing({ ...editing, error: err.fields?.name || err.message });
    } finally {
      setSavingId(null);
    }
  };

  const confirmDeactivate = async () => {
    const category = deactivating;
    setSavingId(category.id);
    try {
      await deactivateCategory(category.id);
      toast.success('Category deactivated.', `"${category.name}" is hidden from forms and the store.`);
      await afterChange();
    } catch (err) {
      toast.error("Couldn't deactivate category", err.message);
    } finally {
      setSavingId(null);
      setDeactivating(null);
    }
  };

  const reactivate = async (category) => {
    setSavingId(category.id);
    try {
      await reactivateCategory(category.id);
      toast.success('Category reactivated.', `"${category.name}" can be used again.`);
      await afterChange();
    } catch (err) {
      toast.error("Couldn't reactivate category", err.message);
    } finally {
      setSavingId(null);
    }
  };

  let body;
  if (status === 'error') {
    body = <ErrorState title="Couldn't load categories" onRetry={load} />;
  } else if (status === 'ready' && categories.length === 0) {
    body = <EmptyState icon={Tags} title="No categories yet" text="Add your first category above." />;
  } else {
    body = (
      <div className="table-scroll">
        <table className="table" aria-busy={status === 'loading' || undefined}>
          <caption className="sr-only">Categories</caption>
          <thead>
            <tr>
              <th scope="col">Category</th>
              <th scope="col" className="num">Active products</th>
              <th scope="col">Status</th>
              <th scope="col" className="num">Actions</th>
            </tr>
          </thead>
          <tbody>
            {status === 'loading' ? (
              <SkeletonRows columns={SKELETON_COLUMNS} rows={8} />
            ) : (
              categories.map((c) => {
                const isEditing = editing?.id === c.id;
                const busy = savingId === c.id;
                return (
                  <tr key={c.id} className={c.active ? undefined : 'is-inactive'}>
                    <td>
                      {isEditing ? (
                        <TextField
                          id={`category-name-${c.id}`}
                          label={`New name for ${c.name}`}
                          hideLabel
                          autoFocus
                          maxLength={50}
                          value={editing.name}
                          error={editing.error}
                          onChange={(e) => setEditing({ ...editing, name: e.target.value, error: '' })}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') saveRename();
                            if (e.key === 'Escape') setEditing(null);
                          }}
                        />
                      ) : (
                        <span className="table__name">{c.name}</span>
                      )}
                    </td>
                    <td className="num">
                      {c.productCount > 0 ? (
                        <Link to={`/products?category=${encodeURIComponent(c.name)}`}>{c.productCount}</Link>
                      ) : (
                        <span className="muted">0</span>
                      )}
                    </td>
                    <td>
                      <span className={`badge ${c.active ? 'badge--in-stock' : 'badge--neutral'}`}>
                        <span className="badge__dot" aria-hidden="true" />
                        {c.active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="col-actions">
                      <div className="row-actions">
                        {isEditing ? (
                          <>
                            <IconButton icon={Check} variant="edit" label={`Save ${c.name}`} onClick={saveRename} disabled={busy} />
                            <IconButton icon={X} label="Cancel renaming" onClick={() => setEditing(null)} disabled={busy} />
                          </>
                        ) : (
                          <>
                            <IconButton
                              icon={Pencil}
                              variant="edit"
                              label={`Rename ${c.name}`}
                              onClick={() => setEditing({ id: c.id, name: c.name, error: '' })}
                              disabled={busy}
                            />
                            {c.active ? (
                              <IconButton
                                icon={EyeOff}
                                variant="delete"
                                label={`Deactivate ${c.name}`}
                                onClick={() => setDeactivating(c)}
                                disabled={busy}
                              />
                            ) : (
                              <IconButton icon={RotateCcw} variant="edit" label={`Reactivate ${c.name}`} onClick={() => reactivate(c)} disabled={busy} />
                            )}
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <>
      <PageIntro description="Organise products into categories shown in the store" />

      <section className="card" aria-label="Categories">
        <form className="toolbar" onSubmit={handleAdd} noValidate>
          <TextField
            id="new-category"
            label="New category name"
            hideLabel
            placeholder="New category name, e.g. Pet Food"
            className="toolbar__search"
            maxLength={50}
            value={newName}
            error={newError}
            onChange={(e) => {
              setNewName(e.target.value);
              if (newError) setNewError('');
            }}
          />
          <div className="toolbar__filters">
            <Button type="submit" leadingIcon={Plus} loading={adding} loadingText="Adding…">
              Add Category
            </Button>
          </div>
        </form>
        {body}
      </section>

      <ConfirmModal
        open={Boolean(deactivating)}
        tone="warning"
        icon={EyeOff}
        title="Deactivate Category?"
        message={
          <>
            Deactivate <strong>“{deactivating?.name}”</strong>?
          </>
        }
        warning="It will be hidden from product forms and the store. You can reactivate it later."
        confirmLabel="Deactivate"
        loadingLabel="Deactivating…"
        loading={savingId === deactivating?.id}
        onConfirm={confirmDeactivate}
        onCancel={() => setDeactivating(null)}
      />
    </>
  );
}
