import { notFound } from 'next/navigation';
import { db } from '@/lib/db';
import { requireSeller } from '@/lib/auth';
import { ProductForm } from '@/components/Forms';

export default async function EditProduct({ params }) {
  const { shop } = await requireSeller();
  const { id } = await params;
  const product = await db
    .prepare('SELECT * FROM products WHERE id = ? AND shop_id = ?')
    .get(Number(id), shop.id);
  if (!product) notFound();
  const categories = await db.prepare('SELECT * FROM categories ORDER BY id').all();
  return (
    <>
      <h1>Edit product</h1>
      <ProductForm categories={categories} product={product} />
    </>
  );
}
