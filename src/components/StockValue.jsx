import { getStockStatus } from '../utils/stock';
import { formatCount } from '../utils/format';

/** Stock number coloured amber when low and red when out of stock. */
export default function StockValue({ stock }) {
  const status = getStockStatus(stock);
  const className = status === 'low' ? 'stock--low' : status === 'out' ? 'stock--out' : undefined;
  return <span className={className}>{formatCount(stock)}</span>;
}
