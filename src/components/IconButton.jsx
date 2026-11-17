import { Link } from 'react-router';
import cx from '../utils/cx';

/**
 * 32px square icon-only button. Always pass `label` – it becomes the
 * aria-label and tooltip. Pass `to` to render a router link instead.
 * variant: edit | delete (delete turns red on hover)
 */
export default function IconButton({ icon: Icon, label, variant, to, className, ...props }) {
  const classes = cx('icon-btn', variant && `icon-btn--${variant}`, className);
  const content = <Icon size={16} aria-hidden="true" />;

  if (to) {
    return (
      <Link to={to} className={classes} aria-label={label} title={label} {...props}>
        {content}
      </Link>
    );
  }
  return (
    <button type="button" className={classes} aria-label={label} title={label} {...props}>
      {content}
    </button>
  );
}
