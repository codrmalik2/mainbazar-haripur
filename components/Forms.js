'use client';

import { useActionState } from 'react';
import { login, placeOrder, registerSeller, saveProduct, saveShopCover } from '@/lib/actions';
import { imageUrl } from '@/lib/image-url';

function Error({ state }) {
  return state?.error ? <p className="error" role="alert">{state.error}</p> : null;
}

export function LoginForm() {
  const [state, action, pending] = useActionState(login, null);
  return (
    <form action={action} className="form">
      <label>Email<input name="email" type="email" required autoComplete="email" /></label>
      <label>Password<input name="password" type="password" required autoComplete="current-password" /></label>
      <Error state={state} />
      <button className="btn" disabled={pending}>{pending ? 'Logging in…' : 'Log in'}</button>
    </form>
  );
}

export function RegisterForm() {
  const [state, action, pending] = useActionState(registerSeller, null);
  return (
    <form action={action} className="form">
      <label>Shop name<input name="shopName" required maxLength={80} /></label>
      <label>Shop address<input name="address" required placeholder="Street, area, Haripur" /></label>
      <label>Phone number<input name="phone" required placeholder="03xx xxxxxxx" /></label>
      <label>
        WhatsApp number <small>(leave empty if same as phone)</small>
        <input name="whatsapp" placeholder="03xx xxxxxxx" />
      </label>
      <label>
        About your shop <small>(optional)</small>
        <textarea name="description" rows={3} maxLength={500} />
      </label>
      <hr />
      <label>Email (for login)<input name="email" type="email" required autoComplete="email" /></label>
      <label>
        Password <small>(min 8 characters)</small>
        <input name="password" type="password" required minLength={8} autoComplete="new-password" />
      </label>
      <Error state={state} />
      <button className="btn" disabled={pending}>{pending ? 'Creating…' : 'Register my shop'}</button>
    </form>
  );
}

export function ProductForm({ categories, product }) {
  const [state, action, pending] = useActionState(saveProduct, null);
  return (
    <form action={action} className="form">
      {product && <input type="hidden" name="id" value={product.id} />}
      <label>Product name<input name="name" required maxLength={100} defaultValue={product?.name} /></label>
      <label>
        Category
        <select name="categoryId" required defaultValue={product?.category_id ?? ''}>
          <option value="" disabled>Choose…</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </label>
      <div className="row">
        <label>Price<input name="price" type="number" min="0" step="1" required defaultValue={product?.price} /></label>
        <label>In stock<input name="stock" type="number" min="0" step="1" required defaultValue={product?.stock ?? 1} /></label>
      </div>
      <label>
        Description <small>(sizes, colours, material…)</small>
        <textarea name="description" rows={4} maxLength={1000} defaultValue={product?.description} />
      </label>
      <label>
        Photo {product ? <small>(leave empty to keep current)</small> : <small>(JPG/PNG/WebP, max 3 MB)</small>}
        <input name="image" type="file" accept="image/jpeg,image/png,image/webp" required={!product} />
      </label>
      {product?.image && <img src={imageUrl(product.image)} alt="" className="thumb" />}
      <label className="check">
        <input type="checkbox" name="active" defaultChecked={product ? !!product.active : true} />
        Show this product to customers
      </label>
      <Error state={state} />
      <button className="btn" disabled={pending}>{pending ? 'Saving…' : 'Save product'}</button>
    </form>
  );
}

export function ShopCoverForm({ cover }) {
  const [state, action, pending] = useActionState(saveShopCover, null);
  return (
    <form action={action} className="form">
      {cover ? (
        <img src={imageUrl(cover)} alt="Current shop banner" className="cover-preview" />
      ) : (
        <p className="muted" style={{ margin: 0 }}>No banner yet. Customers see a plain colour header.</p>
      )}
      <label>
        Banner image <small>(wide photo works best, e.g. 1200×400. JPG/PNG/WebP, max 3 MB)</small>
        <input name="cover" type="file" accept="image/jpeg,image/png,image/webp" />
      </label>
      <Error state={state} />
      {state?.ok && <p className="success" role="status">{state.ok}</p>}
      <div className="actions">
        <button className="btn" disabled={pending}>{pending ? 'Saving…' : 'Upload banner'}</button>
        {cover && (
          <button className="btn ghost" name="remove" value="1" formNoValidate disabled={pending}>
            Remove banner
          </button>
        )}
      </div>
    </form>
  );
}

export function OrderForm({ productId, maxQty }) {
  const [state, action, pending] = useActionState(placeOrder, null);
  return (
    <form action={action} className="form card">
      <h3>Order now — Cash on Delivery</h3>
      <input type="hidden" name="productId" value={productId} />
      <label>Your name<input name="buyerName" required maxLength={80} autoComplete="name" /></label>
      <label>
        Your WhatsApp number
        <input name="buyerPhone" required placeholder="03xx xxxxxxx" autoComplete="tel" />
      </label>
      <label>Delivery address<textarea name="buyerAddress" rows={2} required maxLength={300} autoComplete="street-address" /></label>
      <label>Quantity<input name="qty" type="number" min="1" max={maxQty} defaultValue={1} required /></label>
      <label>Note to seller <small>(size, colour… optional)</small><input name="note" maxLength={300} /></label>
      <Error state={state} />
      <button className="btn" disabled={pending}>{pending ? 'Placing order…' : 'Place order'}</button>
      <p className="muted">You pay in cash when the order is delivered. The seller will confirm with you on WhatsApp first.</p>
    </form>
  );
}
