import Link from 'next/link';
import { db } from '@/lib/db';
import { requireSeller } from '@/lib/auth';
import { updateOrderStatus } from '@/lib/actions';
import { money, NEXT_STATUS, waLink } from '@/lib/util';
import { StatusBadge } from '@/components/ui';

export const metadata = { title: 'Orders — MainBazar Haripur' };

const BUTTON = {
  confirmed: { label: '✔ Confirmed on WhatsApp', cls: 'btn small' },
  packed: { label: '📦 Mark as packed', cls: 'btn small' },
  delivered: { label: '🚚 Mark as delivered (cash received)', cls: 'btn small' },
  cancelled: { label: 'Cancel order', cls: 'btn danger small' },
};

export default async function SellerOrders() {
  const { shop } = await requireSeller();
  const orders = await db
    .prepare(
      `SELECT * FROM orders WHERE shop_id = ?
       ORDER BY (status IN ('delivered','cancelled')), id DESC LIMIT 200`
    )
    .all(shop.id);

  return (
    <>
      <div className="toolbar">
        <h1 style={{ margin: 0 }}>Orders</h1>
        <Link href="/seller" className="btn ghost small">← Back</Link>
      </div>
      <p className="muted">
        Steps: 1) Message the buyer on WhatsApp and confirm → 2) Pack the order → 3) Deliver and collect cash.
        Tick each step here so the buyer can see the progress.
      </p>

      {orders.length === 0 && <p className="muted">No orders yet.</p>}
      <div className="stack">
        {orders.map((o) => {
          const msg = `Hello ${o.buyer_name}, this is ${shop.name} (MainBazar Haripur). Please confirm your order ${o.code}: ${o.qty} × ${o.product_name}, total ${money(o.total)} cash on delivery. Delivery to: ${o.buyer_address}. Is this correct?`;
          return (
            <div key={o.id} className="card">
              <div className="toolbar" style={{ marginBottom: 8 }}>
                <strong>#{o.code}</strong>
                <StatusBadge status={o.status} />
              </div>
              <p style={{ margin: '4px 0' }}><strong>{o.qty} × {o.product_name}</strong> — {money(o.total)} (cash on delivery)</p>
              <p style={{ margin: '4px 0' }}>{o.buyer_name} · {o.buyer_phone}</p>
              <p className="muted" style={{ margin: '4px 0' }}>{o.buyer_address}</p>
              {o.note && <p className="muted" style={{ margin: '4px 0' }}>Note: {o.note}</p>}
              <div className="actions" style={{ marginTop: 10 }}>
                <a className="btn wa small" href={waLink(o.buyer_phone, msg)} target="_blank" rel="noopener noreferrer">Message buyer on WhatsApp</a>
                {NEXT_STATUS[o.status].map((next) => (
                  <form key={next} action={updateOrderStatus}>
                    <input type="hidden" name="id" value={o.id} />
                    <input type="hidden" name="status" value={next} />
                    <button className={BUTTON[next].cls}>{BUTTON[next].label}</button>
                  </form>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
