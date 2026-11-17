import { ChevronLeft, ChevronRight } from 'lucide-react';
import Button from './Button';

/** Page numbers with ellipsis, e.g. 1 … 4 5 6 … 12 */
export function getPageItems(current, total) {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages = new Set([1, total, current - 1, current, current + 1]);
  if (current <= 3) [2, 3, 4].forEach((p) => pages.add(p));
  if (current >= total - 2) [total - 3, total - 2, total - 1].forEach((p) => pages.add(p));
  const sorted = [...pages].filter((p) => p >= 1 && p <= total).sort((a, b) => a - b);

  const items = [];
  sorted.forEach((p, i) => {
    if (i > 0 && p - sorted[i - 1] > 1) items.push(`ellipsis-${p}`);
    items.push(p);
  });
  return items;
}

export default function Pagination({ page, pageSize, total, onPageChange, itemLabel = 'products' }) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);

  return (
    <div className="pagination">
      <p className="pagination__summary">
        Showing <strong>{start}–{end}</strong> of <strong>{total}</strong> {itemLabel}
      </p>
      {totalPages > 1 && (
        <nav className="pagination__nav" aria-label="Pagination">
          <Button
            variant="secondary"
            size="sm"
            leadingIcon={ChevronLeft}
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
          >
            Previous
          </Button>
          <ul className="pagination__list">
            {getPageItems(page, totalPages).map((item) =>
              typeof item === 'number' ? (
                <li key={item}>
                  <button
                    type="button"
                    className="pagination__page"
                    aria-current={item === page ? 'page' : undefined}
                    aria-label={`Page ${item}`}
                    onClick={() => onPageChange(item)}
                  >
                    {item}
                  </button>
                </li>
              ) : (
                <li key={item} className="pagination__ellipsis" aria-hidden="true">
                  …
                </li>
              ),
            )}
          </ul>
          <Button
            variant="secondary"
            size="sm"
            trailingIcon={ChevronRight}
            disabled={page >= totalPages}
            onClick={() => onPageChange(page + 1)}
          >
            Next
          </Button>
        </nav>
      )}
    </div>
  );
}
