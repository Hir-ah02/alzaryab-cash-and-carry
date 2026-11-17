import { Check } from 'lucide-react';
import cx from '../utils/cx';

export default function Checkbox({ id, label, className, ...props }) {
  return (
    <label className={cx('checkbox', className)} htmlFor={id}>
      <span className="checkbox__wrap">
        <input id={id} type="checkbox" className="checkbox__input" {...props} />
        <span className="checkbox__box" aria-hidden="true">
          <Check size={14} strokeWidth={3} />
        </span>
      </span>
      {label}
    </label>
  );
}
