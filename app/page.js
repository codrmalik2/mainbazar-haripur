import Link from 'next/link';
import { db } from '@/lib/db';
import { ProductCard, ShopCard } from '@/components/ui';

export default function Home() {
  const categories = db.prepare('SELECT * FROM categories ORDER BY id').all();
  const products = db
    .prepare(
      `SELECT p.*, s.name AS shop_name FROM products p
       JOIN shops s ON s.id = p.shop_id
       WHERE p.active = 1 AND s.status = 'approved'
       ORDER BY p.id DESC LIMIT 8`
    )
    .all();
  const shops = db
    .prepare(
      `SELECT s.*, (SELECT COUNT(*) FROM products p WHERE p.shop_id = s.id AND p.active = 1) AS product_count
       FROM shops s WHERE s.status = 'approved' ORDER BY s.id DESC LIMIT 6`
    )
    .all();

  return (
    <>
      <section className="hero">
        <h1>All of Haripur's shops, in one place.</h1>
        <p>Browse clothes, shoes and more from your local shopkeepers. Pay cash on delivery.</p>
        <form action="/products">
          <input name="q" placeholder="Search for shoes, shirts, bags…" />
          <button className="btn ghost">Search</button>
        </form>
      </section>

      <div className="chips">
        {categories.map((c) => (
          <Link key={c.id} href={`/products?category=${c.id}`} className="chip">{c.name}</Link>
        ))}
      </div>

      <div className="toolbar">
        <h2>Latest products</h2>
        <Link href="/products">See all →</Link>
      </div>
      {products.length ? (
        <div className="grid">{products.map((p) => <ProductCard key={p.id} p={p} />)}</div>
      ) : (
        <p className="muted">No products yet — shopkeepers are getting set up. Check back soon!</p>
      )}

      <div className="toolbar" style={{ marginTop: 32 }}>
        <h2>Our shops</h2>
        <Link href="/shops">All shops →</Link>
      </div>
      {shops.length ? (
        <div className="grid">{shops.map((s) => <ShopCard key={s.id} s={s} />)}</div>
      ) : (
        <p className="muted">No shops listed yet.</p>
      )}

      <section className="card" style={{ marginTop: 32 }}>
        <h2>Own a shop in Haripur?</h2>
        <p>Register for free, upload your products with photos, and get orders on WhatsApp.</p>
        <Link href="/seller/register" className="btn">Register your shop</Link>
      </section>
    </>
  );
}
