// Web version of mobile/src/components/CartCheckStatus.tsx.
import type { UseQueryResult } from '@tanstack/react-query';
import { RefreshCw } from 'lucide-react';
import { useEffect } from 'react';

import { describeIssue, resolveIssues, type CartProducts, type CartReview } from '@/cart/cartCheck';
import { useCart } from '@/cart/CartProvider';
import { formatPrice } from '@/utils/format';

import { Button, Notice } from './ui';

export function isCartCheckReady(check: UseQueryResult<CartProducts>, review: CartReview | null): review is CartReview {
  return !check.isFetching && check.isSuccess && !!review && review.issues.length === 0 && review.unchecked.length === 0;
}

/** Shows what changed in the live catalogue since items were added, and lets the customer accept it. */
export function CartCheckStatus({ check, review }: { check: UseQueryResult<CartProducts>; review: CartReview | null }) {
  const { removeMany, update } = useCart();

  // Name and photo refreshes change nothing the customer agreed to: apply them silently.
  const quiet = review?.quietUpdates ?? [];
  useEffect(() => {
    if (quiet.length > 0) update(quiet);
  }, [quiet, update]);

  if (check.isError) {
    return (
      <Notice
        tone="warning"
        title="Couldn't check the latest prices and stock"
        action={<Button size="sm" variant="secondary" icon={<RefreshCw className="size-4" />} onClick={() => void check.refetch()} loading={check.isFetching}>Check again</Button>}
      >
        {check.error instanceof Error ? check.error.message : 'Please try again.'}
      </Notice>
    );
  }
  if (!review || review.issues.length === 0) return null;

  const accept = () => {
    if (!check.data) return;
    const { remove, updates } = resolveIssues(review.issues, check.data);
    if (updates.length) update(updates);
    if (remove.length) removeMany(remove);
  };

  return (
    <Notice tone="warning" title="Some items in your cart have changed" action={<Button size="sm" onClick={accept} data-testid="accept-cart-changes">Update my cart</Button>}>
      <ul className="mt-1 list-disc space-y-0.5 pl-4" data-testid="cart-issues">
        {review.issues.map((issue) => <li key={`${issue.kind}-${issue.productId}`}>{describeIssue(issue, formatPrice)}</li>)}
      </ul>
    </Notice>
  );
}
