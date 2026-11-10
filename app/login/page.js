import Link from 'next/link';
import { LoginForm } from '@/components/Forms';

export const metadata = { title: 'Log in — MainBazar Haripur' };

export default function LoginPage() {
  return (
    <>
      <h1>Log in</h1>
      <LoginForm />
      <p className="muted">New shopkeeper? <Link href="/seller/register"><u>Register your shop</u></Link></p>
    </>
  );
}
