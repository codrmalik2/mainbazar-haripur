import { db } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';
import { setShopStatus } from '@/lib/actions';

export const metadata = { title: 'Admin — MainBazar Haripur' };

const LABEL = { approved: 'Approve', rejected: 'Reject', pending: 'Set pending' };

function StatusButtons({ s }) {
  // Pending shops get the two main buttons; others can also be moved back to pending
  const options = s.status === 'pending' ? ['approved', 'rejected'] : ['approved', 'rejected', 'pending'].filter((st) => st !== s.status);
  return (
    <div className="actions">
      {options.map((st) => (
        <form key={st} action={setShopStatus}>
          <input type="hidden" name="id" value={s.id} />
          <input type="hidden" name="status" value={st} />
          <button className={`btn small ${st === 'rejected' ? 'danger' : st === 'pending' ? 'ghost' : ''}`}>{LABEL[st]}</button>
        </form>
      ))}
    </div>
  );
}

function ShopTable({ shops }) {
  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr><th>Shop</th><th>Owner / contact</th><th>Registered</th><th>Products</th><th>Status</th><th></th></tr>
        </thead>
        <tbody>
          {shops.map((s) => (
            <tr key={s.id}>
              <td>
                <strong>{s.name}</strong>
                <br /><small className="muted">{[s.area, s.address].filter(Boolean).join(' · ')}</small>
              </td>
              <td>
                {s.owner_name && <>{s.owner_name}<br /></>}
                {s.email} {s.email_verified ? <small title="Email verified">✔</small> : null}
                <br /><small>{s.phone}</small>
              </td>
              <td><small>{s.created_at?.slice(0, 10)}</small></td>
              <td>{s.product_count}</td>
              <td><span className={`badge badge-${s.status}`}>{s.status}</span></td>
              <td><StatusButtons s={s} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default async function Admin() {
  await requireAdmin();
  const shops = await db
    .prepare(
      `SELECT s.*, u.email, u.email_verified,
        (SELECT COUNT(*) FROM products p WHERE p.shop_id = s.id) AS product_count
       FROM shops s JOIN users u ON u.id = s.user_id
       ORDER BY s.id DESC`
    )
    .all();
  const totals = await db
    .prepare(
      `SELECT (SELECT COUNT(*) FROM orders) AS orders,
              (SELECT COUNT(*) FROM products) AS products`
    )
    .get();

  const pending = shops.filter((s) => s.status === 'pending');
  const others = shops.filter((s) => s.status !== 'pending');

  return (
    <>
      <h1>Admin</h1>
      <p className="muted">{shops.length} shops · {totals.products} products · {totals.orders} orders</p>

      <h2>Pending seller registrations ({pending.length})</h2>
      {pending.length ? (
        <>
          <p className="muted">Approve a shop once its registration fee is verified. The seller gets an email and the shop goes live.</p>
          <ShopTable shops={pending} />
        </>
      ) : (
        <p className="muted">No registrations waiting for approval.</p>
      )}

      <h2 style={{ marginTop: 32 }}>All other shops</h2>
      {others.length ? <ShopTable shops={others} /> : <p className="muted">None yet.</p>}
    </>
  );
}
