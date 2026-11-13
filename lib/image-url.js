/**
 * Turn a stored image value into a URL for <img src>.
 * - Vercel Blob uploads are stored as full https:// URLs.
 * - Local disk uploads are stored as a bare file name served by /uploads/[file].
 * Safe to import from client components (no Node APIs).
 */
export function imageUrl(value) {
  if (!value) return '';
  return /^https?:\/\//.test(value) ? value : `/uploads/${value}`;
}
