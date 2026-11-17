import { ShoppingBasket } from 'lucide-react';
import { useState } from 'react';

import { cx } from './ui';

/** Product photo from the API (served via /media), with a neutral placeholder when missing or broken. */
export function ProductImage({ src, alt, className, eager }: { src: string | null; alt: string; className?: string; eager?: boolean }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    return (
      <div className={cx('flex items-center justify-center bg-surface-muted text-line-strong', className)} role="img" aria-label={alt}>
        <ShoppingBasket className="size-1/3 max-h-16 max-w-16" aria-hidden />
      </div>
    );
  }
  return (
    <img
      src={src}
      alt={alt}
      loading={eager ? 'eager' : 'lazy'}
      decoding="async"
      onError={() => setFailed(true)}
      className={cx('bg-white object-contain', className)}
    />
  );
}
