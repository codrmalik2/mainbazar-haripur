import { db } from '@/lib/db';
import { requireApprovedSeller } from '@/lib/auth';
import { ProductForm } from '@/components/Forms';

export default async function NewProduct() {
  await requireApprovedSeller();
  const categories = await db.prepare('SELECT * FROM categories ORDER BY id').all();
  return (
    <>
      <h1>Add product</h1>
      <ProductForm categories={categories} />
    </>
  );
}
