import { db } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';
import { setShopStatus } from '@/lib/actions';

export const metadata = { title: 'Admin — MainBazar Haripur' };

export default async function Admin() {
  await requireAdmin();
  const shops = await db
    .prepare(
      `SELECT s.*, u.email,
        (SELECT COUNT(*) FROM products p WHERE p.shop_id = s.id) AS product_count
       FROM shops s JOIN users u ON u.id = s.user_id
       ORDER BY (s.status = 'pending') DESC, s.id DESC`
    )
    .all();
  const totals = await db
    .prepare(
      `SELECT (SELECT COUNT(*) FROM orders) AS orders,
              (SELECT COUNT(*) FROM products) AS products`
    )
    .get();

  return (
    <>
      <h1>Admin</h1>
      <p className="muted">{shops.length} shops · {totals.products} products · {totals.orders} orders</p>
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr><th>Shop</th><th>Contact</th><th>Products</th><th>Status</th><th></th></tr>
          </thead>
          <tbody>
            {shops.map((s) => (
              <tr key={s.id}>
                <td><strong>{s.name}</strong><br /><small className="muted">{s.address}</small></td>
                <td>{s.email}<br /><small>{s.phone}</small></td>
                <td>{s.product_count}</td>
                <td><span className={`badge badge-${s.status}`}>{s.status}</span></td>
                <td>
                  <div className="actions">
                    {['approved', 'rejected', 'pending']
                      .filter((st) => st !== s.status)
                      .map((st) => (
                        <form key={st} action={setShopStatus}>
                          <input type="hidden" name="id" value={s.id} />
                          <input type="hidden" name="status" value={st} />
                          <button className={`btn small ${st === 'rejected' ? 'danger' : st === 'pending' ? 'ghost' : ''}`}>
                            {st === 'approved' ? 'Approve' : st === 'rejected' ? 'Reject' : 'Set pending'}
                          </button>
                        </form>
                      ))}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
