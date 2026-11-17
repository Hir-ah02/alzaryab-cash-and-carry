import { MapPin, Plus } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';

import type { Address } from '@/api/types';
import { useAuth } from '@/auth/AuthProvider';
import { AddressForm, AddressText } from '@/components/AddressForm';
import { useToast } from '@/components/Toast';
import { Button, Card, EmptyState, ErrorState, Notice, PageHeading, Spinner } from '@/components/ui';
import { useAddresses, useAddressMutations } from '@/hooks/useCustomer';

const MAX_ADDRESSES = 10;

export default function AddressesPage() {
  const { customer } = useAuth();
  const addresses = useAddresses();
  const { create, update, remove, makeDefault } = useAddressMutations();
  const toast = useToast();
  const [editing, setEditing] = useState<Address | 'new' | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (addresses.isPending) return <Spinner label="Loading addresses…" />;
  if (addresses.isError) return <ErrorState error={addresses.error} onRetry={() => void addresses.refetch()} />;

  const list = addresses.data;
  const canAdd = list.length < MAX_ADDRESSES;

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 sm:py-8">
      <PageHeading
        title="Saved addresses"
        subtitle={<Link to="/account" className="text-brand-700 hover:underline">← My account</Link>}
        action={canAdd && editing === null && list.length > 0 ? <Button icon={<Plus className="size-4" />} onClick={() => setEditing('new')}>Add address</Button> : undefined}
      />
      {error && <Notice tone="error" className="mb-4">{error}</Notice>}

      {editing !== null && (
        <Card className="mb-5 p-4 sm:p-6">
          <h2 className="mb-4 text-lg font-bold">{editing === 'new' ? 'New address' : 'Edit address'}</h2>
          <AddressForm
            key={editing === 'new' ? 'new' : editing.id}
            initial={editing === 'new' ? { recipientName: customer?.name ?? '', phone: customer?.phone ?? '', isDefault: list.length === 0 } : editing}
            submitLabel="Save address"
            showDefaultOption
            onCancel={() => setEditing(null)}
            onSubmit={async (input) => {
              if (editing === 'new') await create.mutateAsync(input);
              else await update.mutateAsync({ id: editing.id, changes: input });
              setEditing(null);
              toast('Address saved');
            }}
          />
        </Card>
      )}

      {list.length === 0 && editing === null ? (
        <EmptyState icon={<MapPin className="size-7" />} title="No saved addresses" text="Save an address to check out faster." action={<Button icon={<Plus className="size-4" />} onClick={() => setEditing('new')}>Add address</Button>} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {list.map((a) => (
            <Card key={a.id} className="flex flex-col p-4" >
              <div className="mb-2 flex flex-wrap gap-2 text-xs font-semibold uppercase tracking-wide">
                {a.label && <span className="text-ink-3">{a.label}</span>}
                {a.isDefault && <span className="rounded-full bg-brand-50 px-2 py-0.5 text-brand-700">Default</span>}
              </div>
              <AddressText address={a} />
              <div className="mt-4 flex flex-wrap gap-2 border-t border-line pt-3">
                <Button size="sm" variant="secondary" onClick={() => setEditing(a)}>Edit</Button>
                {!a.isDefault && <Button size="sm" variant="ghost" onClick={() => makeDefault.mutate(a.id)}>Make default</Button>}
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-danger hover:bg-danger-bg"
                  onClick={() => {
                    if (!window.confirm('Delete this address? Past orders keep their own copy.')) return;
                    setError(null);
                    remove.mutate(a.id, { onError: (err) => setError(err.message) });
                  }}
                >
                  Delete
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
      {!canAdd && <p className="mt-4 text-sm text-ink-2">You can save up to {MAX_ADDRESSES} addresses. Delete one to add another.</p>}
    </div>
  );
}
