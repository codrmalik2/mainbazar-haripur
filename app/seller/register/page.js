import Link from 'next/link';
import SellerSignup from '@/components/SellerSignup';
import { getVerifiedSignupEmail } from '@/lib/seller-signup';

export const metadata = { title: 'Register your shop — MainBazar Haripur' };

export default async function RegisterPage() {
  // If this browser already verified its email (e.g. page refresh), continue at step 3
  const verifiedEmail = await getVerifiedSignupEmail();
  return (
    <>
      <h1>Register your shop</h1>
      <p className="muted">First verify your email, then enter your shop details. Our team approves new shops before they go live.</p>
      <SellerSignup verifiedEmail={verifiedEmail} />
      <p className="muted">Already registered? <Link href="/login"><u>Log in</u></Link></p>
    </>
  );
}
