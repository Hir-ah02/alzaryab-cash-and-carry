import { Link } from 'react-router';
import { ChevronRight } from 'lucide-react';

/**
 * Top of every page's content: optional breadcrumb, a one-line
 * description, and the page's main action on the right.
 * breadcrumb: [{ label, to? }] – the last item is the current page.
 */
export default function PageIntro({ breadcrumb, description, action }) {
  return (
    <div className="page-intro">
      <div className="page-intro__text">
        {breadcrumb && (
          <nav className="breadcrumb" aria-label="Breadcrumb">
            <ol>
              {breadcrumb.map((crumb, i) => {
                const last = i === breadcrumb.length - 1;
                return (
                  <li key={crumb.label}>
                    {last || !crumb.to ? (
                      <span aria-current={last ? 'page' : undefined}>{crumb.label}</span>
                    ) : (
                      <Link to={crumb.to}>{crumb.label}</Link>
                    )}
                    {!last && <ChevronRight size={14} className="breadcrumb__sep" aria-hidden="true" />}
                  </li>
                );
              })}
            </ol>
          </nav>
        )}
        {description && <p className="page-intro__desc">{description}</p>}
      </div>
      {action && <div className="page-intro__action">{action}</div>}
    </div>
  );
}
