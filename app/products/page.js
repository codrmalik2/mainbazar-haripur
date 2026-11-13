import Link from 'next/link';
import { db } from '@/lib/db';
import { ProductCard } from '@/components/ui';

export const metadata = { title: 'Products — MainBazar Haripur' };

export default async function Products({ searchParams }) {
  const sp = await searchParams;
  const q = String(sp.q ?? '').trim().slice(0, 80);
  const category = Number(sp.category) || null;

  const categories = await db.prepare('SELECT * FROM categories ORDER BY id').all();
  const where = ["p.active = 1", "s.status = 'approved'"];
  const args = [];
  if (q) {
    where.push('(p.name LIKE ? OR p.description LIKE ? OR s.name LIKE ?)');
    const like = `%${q.replace(/[%_]/g, '')}%`;
    args.push(like, like, like);
  }
  if (category) {
    where.push('p.category_id = ?');
    args.push(category);
  }

  const products = await db
    .prepare(
      `SELECT p.*, s.name AS shop_name FROM products p
       JOIN shops s ON s.id = p.shop_id
       WHERE ${where.join(' AND ')} ORDER BY p.id DESC LIMIT 100`
    )
    .all(...args);

  return (
    <>
      <h1>Products</h1>
      <form action="/products" className="toolbar">
        <input name="q" defaultValue={q} placeholder="Search products or shops…" style={{ maxWidth: 360 }} />
        {category && <input type="hidden" name="category" value={category} />}
        <button className="btn">Search</button>
      </form>
      <div className="chips">
        <Link href={q ? `/products?q=${encodeURIComponent(q)}` : '/products'} className={`chip ${!category ? 'active' : ''}`}>All</Link>
        {categories.map((c) => (
          <Link
            key={c.id}
            href={`/products?category=${c.id}${q ? `&q=${encodeURIComponent(q)}` : ''}`}
            className={`chip ${category === c.id ? 'active' : ''}`}
          >
            {c.name}
          </Link>
        ))}
      </div>
      {products.length ? (
        <div className="grid">{products.map((p) => <ProductCard key={p.id} p={p} />)}</div>
      ) : (
        <p className="muted">No products found.</p>
      )}
    </>
  );
}
