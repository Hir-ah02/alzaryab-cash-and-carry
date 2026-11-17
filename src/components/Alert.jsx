import { CircleAlert, TriangleAlert } from 'lucide-react';
import cx from '../utils/cx';

const ICONS = { error: CircleAlert, warning: TriangleAlert };

/** Inline alert. variant: error | warning */
export default function Alert({ variant = 'error', title, children, className, ...props }) {
  const Icon = ICONS[variant];
  return (
    <div className={cx('alert', `alert--${variant}`, className)} {...props}>
      <span className="alert__icon" aria-hidden="true">
        <Icon size={18} />
      </span>
      <div className="alert__content">
        {title && <p className="alert__title">{title}</p>}
        {children && <div>{children}</div>}
      </div>
    </div>
  );
}
