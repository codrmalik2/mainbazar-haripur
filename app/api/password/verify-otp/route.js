import { verifyResetOtp } from '@/lib/password-reset';
import { jsonRoute } from '@/app/api/seller/handler';

// Forgot password step 2: check the code, return the account name for confirmation
export const POST = jsonRoute((body) => verifyResetOtp(body.email, body.code));
