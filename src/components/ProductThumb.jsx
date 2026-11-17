import { useState } from 'react';
import { Image as ImageIcon } from 'lucide-react';
import cx from '../utils/cx';

/** 40px product image, or a placeholder icon when there is no (loadable) image. */
export default function ProductThumb({ src, size = 'md' }) {
  const [failedSrc, setFailedSrc] = useState(null);
  const showImage = src && failedSrc !== src;

  return (
    <span className={cx('thumb', size === 'lg' && 'thumb--lg')}>
      {showImage ? (
        <img src={src} alt="" loading="lazy" onError={() => setFailedSrc(src)} />
      ) : (
        <ImageIcon size={18} aria-hidden="true" />
      )}
    </span>
  );
}
