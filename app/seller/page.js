import Link from 'next/link';
import { db } from '@/lib/db';
import { requireSeller } from '@/lib/auth';
import { deleteProduct } from '@/lib/actions';
import { money } from '@/lib/util';
import { StatusBadge } from '@/components/ui';
import { ShopCoverForm } from '@/components/Forms';

export const metadata = { title: 'My shop — MainBazar Haripur' };

export default async function SellerDashboard() {
  const { shop } = await requireSeller();
  const products = db.prepare('SELECT * FROM products WHERE shop_id = ? ORDER BY id DESC').all(shop.id);
  const newOrders = db
    .prepare("SELECT COUNT(*) AS n FROM orders WHERE shop_id = ? AND status = 'placed'")
    .get(shop.id).n;
  const openOrders = db
    .prepare("SELECT COUNT(*) AS n FROM orders WHERE shop_id = ? AND status IN ('confirmed','packed')")
    .get(shop.id).n;

  return (
    <>
      <div className="toolbar">
        <h1 style={{ margin: 0 }}>{shop.name}</h1>
        <span className={`badge badge-${shop.status}`}>{shop.status}</span>
      </div>

      {shop.status === 'pending' && (
        <div className="banner">Your shop is waiting for approval. You can add products now — customers will see them once approved.</div>
      )}
      {shop.status === 'rejected' && (
        <div className="banner bad">Your shop was not approved. Please contact the MainBazar team.</div>
      )}

      <div className="actions" style={{ marginBottom: 20 }}>
        <Link href="/seller/orders" className="btn">
          Orders {newOrders > 0 && `(${newOrders} new)`}
        </Link>
        <Link href="/seller/products/new" className="btn ghost">+ Add product</Link>
      </div>
      <p className="muted">{openOrders} order(s) in progress.</p>

      <h2>Shop banner</h2>
      <div className="card" style={{ marginBottom: 24 }}>
        <ShopCoverForm cover={shop.cover} />
      </div>

      <h2>My products</h2>
      {products.length ? (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr><th></th><th>Name</th><th>Price</th><th>Stock</th><th>Visible</th><th></th></tr>
            </thead>
            <tbody>
              {products.map((p) => (
                <tr key={p.id}>
                  <td>{p.image && <img src={`/uploads/${p.image}`} alt="" width={48} height={48} style={{ objectFit: 'cover', borderRadius: 6 }} />}</td>
                  <td>{p.name}</td>
                  <td>{money(p.price)}</td>
                  <td>{p.stock}</td>
                  <td>{p.active ? 'Yes' : 'Hidden'}</td>
                  <td>
                    <div className="actions">
                      <Link href={`/seller/products/${p.id}`} className="btn ghost small">Edit</Link>
                      <form action={deleteProduct}>
                        <input type="hidden" name="id" value={p.id} />
                        <button className="btn danger small">Delete</button>
                      </form>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="muted">You haven't added any products yet. Click "Add product" to start.</p>
      )}
    </>
  );
}
