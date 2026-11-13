import { db } from '@/lib/db';
import { requireSeller } from '@/lib/auth';
import { ProductForm } from '@/components/Forms';

export default async function NewProduct() {
  await requireSeller();
  const categories = await db.prepare('SELECT * FROM categories ORDER BY id').all();
  return (
    <>
      <h1>Add product</h1>
      <ProductForm categories={categories} />
    </>
  );
}
