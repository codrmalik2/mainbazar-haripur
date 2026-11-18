import { sendResetOtp } from '@/lib/password-reset';
import { jsonRoute } from '@/app/api/seller/handler';

// Forgot password step 1: email a 6-digit code to a registered account
export const POST = jsonRoute((body) => sendResetOtp(body.email));
