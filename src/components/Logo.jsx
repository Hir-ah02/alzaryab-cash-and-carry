import { ShoppingBasket } from 'lucide-react';
import cx from '../utils/cx';

export function LogoMark({ size = 'md' }) {
  return (
    <span className={cx('logo-mark', size === 'lg' && 'logo-mark--lg')} aria-hidden="true">
      <ShoppingBasket size={size === 'lg' ? 28 : 22} strokeWidth={2.25} />
    </span>
  );
}

export default function Logo() {
  return (
    <>
      <LogoMark />
      <span className="logo-text">
        <span className="logo-text__name">Alzaryab</span>
        <span className="logo-text__sub">Cash &amp; Carry</span>
      </span>
    </>
  );
}
