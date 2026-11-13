import Link from 'next/link';
import { notFound } from 'next/navigation';
import { db } from '@/lib/db';
import { money, waLink } from '@/lib/util';
import { OrderForm } from '@/components/Forms';
import { imageUrl } from '@/lib/image-url';

export default async function ProductPage({ params }) {
  const { id } = await params;
  const p = await db
    .prepare(
      `SELECT p.*, c.name AS category_name,
              s.name AS shop_name, s.address AS shop_address, s.phone AS shop_phone,
              s.whatsapp AS shop_whatsapp, s.id AS sid
       FROM products p
       JOIN shops s ON s.id = p.shop_id
       JOIN categories c ON c.id = p.category_id
       WHERE p.id = ? AND p.active = 1 AND s.status = 'approved'`
    )
    .get(Number(id));
  if (!p) notFound();

  const ask = `Hello ${p.shop_name}, I saw "${p.name}" on MainBazar Haripur. Is it available?`;

  return (
    <div className="detail">
      <div>{p.image && <img className="main" src={imageUrl(p.image)} alt={p.name} />}</div>
      <div className="stack">
        <small className="muted">{p.category_name}</small>
        <h1 style={{ margin: 0 }}>{p.name}</h1>
        <div className="price" style={{ fontSize: '1.5rem' }}>{money(p.price)}</div>
        {p.description && <p style={{ whiteSpace: 'pre-wrap' }}>{p.description}</p>}
        <p>{p.stock > 0 ? <>In stock: <strong>{p.stock}</strong></> : <span className="out">Out of stock</span>}</p>

        <div className="card">
          <strong><Link href={`/shops/${p.sid}`}>{p.shop_name}</Link></strong>
          <div className="muted">{p.shop_address}</div>
          <div className="actions" style={{ marginTop: 10 }}>
            <a className="btn wa small" href={waLink(p.shop_whatsapp, ask)} target="_blank" rel="noopener noreferrer">Chat on WhatsApp</a>
            <a className="btn ghost small" href={`tel:${p.shop_phone}`}>Call shop</a>
          </div>
        </div>

        {p.stock > 0 && <OrderForm productId={p.id} maxQty={p.stock} />}
      </div>
    </div>
  );
}
