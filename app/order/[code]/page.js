import { notFound } from 'next/navigation';
import { db } from '@/lib/db';
import { money, waLink } from '@/lib/util';
import { Progress } from '@/components/ui';

export const metadata = { title: 'Your order — MainBazar Haripur' };

export default async function OrderPage({ params }) {
  const { code } = await params;
  const o = db
    .prepare(
      `SELECT o.*, s.name AS shop_name, s.whatsapp AS shop_whatsapp, s.phone AS shop_phone
       FROM orders o JOIN shops s ON s.id = o.shop_id WHERE o.code = ?`
    )
    .get(String(code).toUpperCase());
  if (!o) notFound();

  const msg = `Hello ${o.shop_name}, this is ${o.buyer_name}. My MainBazar order is ${o.code} (${o.qty} × ${o.product_name}).`;

  return (
    <div className="stack" style={{ maxWidth: 640 }}>
      <h1>Thank you, {o.buyer_name}!</h1>
      <p>
        Your order code is <strong style={{ fontSize: '1.3rem', letterSpacing: 2 }}>{o.code}</strong>.
        Save this page — you can come back to it to see your order status.
      </p>
      <Progress status={o.status} />
      <div className="card">
        <p><strong>{o.qty} × {o.product_name}</strong> from {o.shop_name}</p>
        <p>Total to pay on delivery: <strong>{money(o.total)}</strong></p>
        <p className="muted">Deliver to: {o.buyer_address}</p>
        {o.note && <p className="muted">Note: {o.note}</p>}
      </div>
      <p>The seller will message you on WhatsApp to confirm. You can also message them:</p>
      <div className="actions">
        <a className="btn wa" href={waLink(o.shop_whatsapp, msg)} target="_blank" rel="noopener noreferrer">Chat with seller</a>
        <a className="btn ghost" href={`tel:${o.shop_phone}`}>Call shop</a>
      </div>
    </div>
  );
}
