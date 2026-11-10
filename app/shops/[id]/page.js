import { notFound } from 'next/navigation';
import { db } from '@/lib/db';
import { waLink } from '@/lib/util';
import { ProductCard } from '@/components/ui';

export default async function ShopPage({ params }) {
  const { id } = await params;
  const shop = db.prepare("SELECT * FROM shops WHERE id = ? AND status = 'approved'").get(Number(id));
  if (!shop) notFound();

  const products = db
    .prepare(
      `SELECT p.*, s.name AS shop_name FROM products p
       JOIN shops s ON s.id = p.shop_id
       WHERE p.shop_id = ? AND p.active = 1 ORDER BY p.id DESC`
    )
    .all(shop.id);

  return (
    <>
      <div className="card" style={{ marginBottom: 24 }}>
        <h1 style={{ marginTop: 0 }}>{shop.name}</h1>
        {shop.description && <p>{shop.description}</p>}
        <p className="muted">{shop.address}</p>
        <div className="actions">
          <a className="btn wa small" href={waLink(shop.whatsapp, `Hello ${shop.name}, I found you on MainBazar Haripur.`)} target="_blank" rel="noopener noreferrer">WhatsApp</a>
          <a className="btn ghost small" href={`tel:${shop.phone}`}>Call</a>
        </div>
      </div>
      {products.length ? (
        <div className="grid">{products.map((p) => <ProductCard key={p.id} p={p} />)}</div>
      ) : (
        <p className="muted">This shop hasn't added products yet.</p>
      )}
    </>
  );
}
