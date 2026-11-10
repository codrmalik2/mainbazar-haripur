import crypto from 'node:crypto';

export const CURRENCY = process.env.CURRENCY || 'Rs';

export function money(n) {
  return `${CURRENCY} ${Number(n).toLocaleString('en-US')}`;
}

/** Build a wa.me link. Numbers starting with 0 get the default country code. */
export function waLink(number, text = '') {
  let d = String(number || '').replace(/\D/g, '');
  if (d.startsWith('00')) d = d.slice(2);
  else if (d.startsWith('0')) d = (process.env.DEFAULT_COUNTRY_CODE || '92') + d.slice(1);
  return `https://wa.me/${d}${text ? `?text=${encodeURIComponent(text)}` : ''}`;
}

export const ORDER_STEPS = ['placed', 'confirmed', 'packed', 'delivered'];

export const STATUS_LABEL = {
  placed: 'Order placed',
  confirmed: 'Confirmed by seller',
  packed: 'Packed',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
};

/** Allowed next statuses for the seller. */
export const NEXT_STATUS = {
  placed: ['confirmed', 'cancelled'],
  confirmed: ['packed', 'cancelled'],
  packed: ['delivered', 'cancelled'],
  delivered: [],
  cancelled: [],
};

export function newOrderCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = crypto.randomBytes(8);
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('');
}
