import { verifyOtp } from '@/lib/seller-signup';
import { jsonRoute } from '../handler';

// Step 2: check the code; on success this browser may complete step 3
export const POST = jsonRoute((body) => verifyOtp(body.email, body.code));
