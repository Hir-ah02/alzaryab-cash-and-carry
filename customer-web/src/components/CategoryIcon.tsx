import { Apple, Baby, Cookie, Croissant, CupSoda, Droplet, Flame, Milk, ShoppingBasket, Snowflake, Sparkles, SprayCan, Wheat, type LucideIcon } from 'lucide-react';

/** Icon by keyword in the category name; categories added later fall back to a basket. */
const RULES: [RegExp, LucideIcon][] = [
  [/fruit|vegetable|produce/i, Apple],
  [/dairy|egg|milk/i, Milk],
  [/beverage|drink|juice/i, CupSoda],
  [/snack|biscuit|sweet/i, Cookie],
  [/bakery|bread/i, Croissant],
  [/rice|flour|grain|atta/i, Wheat],
  [/oil|ghee/i, Droplet],
  [/spice|masala/i, Flame],
  [/frozen/i, Snowflake],
  [/personal|beauty|care/i, Sparkles],
  [/household|clean/i, SprayCan],
  [/baby/i, Baby],
];

export function CategoryIcon({ name, className }: { name: string; className?: string }) {
  // Baby care must win over "care".
  const Icon = /baby/i.test(name) ? Baby : RULES.find(([re]) => re.test(name))?.[1] ?? ShoppingBasket;
  return <Icon className={className} aria-hidden />;
}
