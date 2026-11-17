/** Joins truthy class names: cx('a', cond && 'b') → 'a b' */
export default function cx(...classes) {
  return classes.filter(Boolean).join(' ');
}
