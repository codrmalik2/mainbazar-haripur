import { sendOtp } from '@/lib/seller-signup';
import { jsonRoute } from '../handler';

// Step 1: check the email isn't registered, then email a 6-digit code
export const POST = jsonRoute((body) => sendOtp(body.email));
