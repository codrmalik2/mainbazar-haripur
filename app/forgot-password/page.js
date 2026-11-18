import Link from 'next/link';
import ForgotPassword from '@/components/ForgotPassword';
import { getVerifiedReset } from '@/lib/password-reset';

export const metadata = { title: 'Forgot password — MainBazar Haripur' };

export default async function ForgotPasswordPage() {
  // If this browser already verified a code (e.g. page refresh), continue at the new-password step
  const verified = await getVerifiedReset();
  return (
    <>
      <h1>Forgot password</h1>
      <p className="muted">Enter the email you registered with. We will send you a 6-digit code to reset your password.</p>
      <ForgotPassword verified={verified} />
      <p className="muted">Remembered it? <Link href="/login"><u>Back to log in</u></Link></p>
    </>
  );
}
