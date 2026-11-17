import { Link } from 'react-router';
import { ArrowRight } from 'lucide-react';
import cx from '../utils/cx';
import { formatCount } from '../utils/format';

/**
 * Dashboard metric card.
 * tone: neutral | warning | error (warning/error add a coloured top accent)
 * to:   optional link target – the whole card becomes clickable.
 */
export default function SummaryCard({ label, value, format = formatCount, hint, icon: Icon, tone = 'neutral', to, linkLabel, loading }) {
  const classes = cx('card', 'summary-card', tone !== 'neutral' && `summary-card--${tone}`);

  const body = (
    <>
      <div>
        <p className="summary-card__label">{label}</p>
        {loading ? (
          <span className="skeleton skeleton-number" aria-hidden="true" />
        ) : (
          <p className="summary-card__value">{format(value)}</p>
        )}
        {hint && <p className="summary-card__hint">{hint}</p>}
        {to && linkLabel && (
          <span className="summary-card__link">
            {linkLabel}
            <ArrowRight size={14} aria-hidden="true" />
          </span>
        )}
      </div>
      <span className="summary-card__icon" aria-hidden="true">
        <Icon size={22} />
      </span>
    </>
  );

  if (to) {
    return (
      <Link to={to} className={classes} aria-busy={loading || undefined}>
        {body}
      </Link>
    );
  }
  return (
    <div className={classes} aria-busy={loading || undefined}>
      {body}
    </div>
  );
}
