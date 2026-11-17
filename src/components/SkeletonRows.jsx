const WIDTHS = [140, 180, 120, 160, 200];

function Cell({ type, row }) {
  switch (type) {
    case 'thumb':
      return <span className="skeleton skeleton--thumb" />;
    case 'product':
      return (
        <span style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span className="skeleton skeleton--thumb" />
          <span className="skeleton skeleton--text" style={{ width: WIDTHS[row % WIDTHS.length] }} />
        </span>
      );
    case 'name':
      return <span className="skeleton skeleton--text" style={{ width: WIDTHS[row % WIDTHS.length] }} />;
    case 'pill':
      return <span className="skeleton skeleton--pill" />;
    case 'num':
      return <span className="skeleton skeleton--text" style={{ width: 48, float: 'right' }} />;
    case 'actions':
      return (
        <span style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
          <span className="skeleton" style={{ width: 32, height: 32, borderRadius: 8 }} />
          <span className="skeleton" style={{ width: 32, height: 32, borderRadius: 8 }} />
        </span>
      );
    default:
      return <span className="skeleton skeleton--text" style={{ width: 72 + (row % 3) * 16 }} />;
  }
}

/** Placeholder table rows shown while data loads. columns: array of cell types. */
export default function SkeletonRows({ columns, rows = 6 }) {
  return Array.from({ length: rows }, (_, r) => (
    <tr key={r} aria-hidden="true">
      {columns.map((type, c) => (
        <td key={c}>
          <Cell type={type} row={r + c} />
        </td>
      ))}
    </tr>
  ));
}
