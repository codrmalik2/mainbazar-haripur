import Link from 'next/link';
import { RegisterForm } from '@/components/Forms';

export const metadata = { title: 'Register your shop — MainBazar Haripur' };

export default function RegisterPage() {
  return (
    <>
      <h1>Register your shop</h1>
      <p className="muted">Free. After you register, our team approves your shop and it appears on MainBazar.</p>
      <RegisterForm />
      <p className="muted">Already registered? <Link href="/login"><u>Log in</u></Link></p>
    </>
  );
}
