import cx from '../utils/cx';

/** Centered icon + title + text + optional action. tone: neutral | success | error */
export default function EmptyState({ icon: Icon, title, text, action, tone = 'neutral', compact = false, role }) {
  return (
    <div className={cx('state', compact && 'state--compact', tone !== 'neutral' && `state--${tone}`)} role={role}>
      {Icon && (
        <span className="state__icon" aria-hidden="true">
          <Icon size={24} />
        </span>
      )}
      <h3 className="state__title">{title}</h3>
      {text && <p className="state__text">{text}</p>}
      {action && <div className="state__action">{action}</div>}
    </div>
  );
}
