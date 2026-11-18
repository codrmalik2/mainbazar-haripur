import Link from 'next/link';
import { LoginForm } from '@/components/Forms';

export const metadata = { title: 'Log in — MainBazar Haripur' };

export default async function LoginPage({ searchParams }) {
  const { reset } = await searchParams;
  return (
    <>
      <h1>Log in</h1>
      {reset === '1' && (
        <p className="success" role="status">Password updated. Log in with your new password.</p>
      )}
      <LoginForm />
      <p><Link href="/forgot-password"><u>Forgot password?</u></Link></p>
      <p className="muted">New shopkeeper? <Link href="/seller/register"><u>Register your shop</u></Link></p>
    </>
  );
}
