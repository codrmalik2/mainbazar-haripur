import Link from 'next/link';
import './globals.css';
import { getUser } from '@/lib/auth';
import { logout } from '@/lib/actions';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'MainBazar Haripur — all our city\'s shops in one place',
  description: 'Browse clothes, shoes and more from local shops in Haripur. Cash on delivery.',
};

export default async function RootLayout({ children }) {
  const user = await getUser();
  return (
    <html lang="en">
      <body>
        <header className="header">
          <div className="container nav">
            <Link href="/" className="logo">MainBazar <span>Haripur</span></Link>
            <nav>
              <Link href="/products">Products</Link>
              <Link href="/shops">Shops</Link>
              {user?.role === 'seller' && <Link href="/seller">My shop</Link>}
              {user?.role === 'admin' && <Link href="/admin">Admin</Link>}
              {user ? (
                <form action={logout}><button className="linkbtn">Log out</button></form>
              ) : (
                <>
                  <Link href="/login">Log in</Link>
                  <Link href="/seller/register" className="btn small">Sell on MainBazar</Link>
                </>
              )}
            </nav>
          </div>
        </header>
        <main className="container">{children}</main>
        <footer className="footer">
          <div className="container">
            <p>© MainBazar Haripur — supporting our local shopkeepers.</p>
            <p className="muted">Pay cash on delivery. Seller and buyer chat on WhatsApp.</p>
          </div>
        </footer>
      </body>
    </html>
  );
}
