import { db } from '@/lib/db';
import { ShopCard } from '@/components/ui';

export const metadata = { title: 'Shops — MainBazar Haripur' };

export default function Shops() {
  const shops = db
    .prepare(
      `SELECT s.*, (SELECT COUNT(*) FROM products p WHERE p.shop_id = s.id AND p.active = 1) AS product_count
       FROM shops s WHERE s.status = 'approved' ORDER BY s.name`
    )
    .all();
  return (
    <>
      <h1>Shops in Haripur</h1>
      {shops.length ? (
        <div className="grid">{shops.map((s) => <ShopCard key={s.id} s={s} />)}</div>
      ) : (
        <p className="muted">No shops listed yet.</p>
      )}
    </>
  );
}
