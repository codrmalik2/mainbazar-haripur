import Link from 'next/link';
import { money, STATUS_LABEL, ORDER_STEPS } from '@/lib/util';
import { imageUrl } from '@/lib/image-url';

export function ProductCard({ p }) {
  return (
    <Link href={`/products/${p.id}`} className="pcard">
      {p.image ? <img src={imageUrl(p.image)} alt={p.name} loading="lazy" /> : <div className="noimg" />}
      <div className="pcard-body">
        <strong>{p.name}</strong>
        <span className="price">{money(p.price)}</span>
        <small className="muted">{p.shop_name}</small>
        {p.stock < 1 && <small className="out">Out of stock</small>}
      </div>
    </Link>
  );
}

export function ShopCard({ s }) {
  return (
    <Link href={`/shops/${s.id}`} className="card shopcard">
      {s.cover ? (
        <img src={imageUrl(s.cover)} alt="" loading="lazy" className="shopcard-cover" />
      ) : (
        <div className="shopcard-cover plain" />
      )}
      <strong>{s.name}</strong>
      <small className="muted">{s.address}</small>
      <small>{s.product_count} product{s.product_count === 1 ? '' : 's'}</small>
    </Link>
  );
}

export function StatusBadge({ status }) {
  return <span className={`badge badge-${status}`}>{STATUS_LABEL[status]}</span>;
}

export function Progress({ status }) {
  if (status === 'cancelled') return <p><StatusBadge status="cancelled" /></p>;
  const at = ORDER_STEPS.indexOf(status);
  return (
    <ol className="steps">
      {ORDER_STEPS.map((s, i) => (
        <li key={s} className={i <= at ? 'done' : ''}>{STATUS_LABEL[s]}</li>
      ))}
    </ol>
  );
}
