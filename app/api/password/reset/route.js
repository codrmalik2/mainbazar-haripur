import { resetPassword } from '@/lib/password-reset';
import { jsonRoute } from '@/app/api/seller/handler';

// Forgot password step 3: save the new password (verified browser only)
export const POST = jsonRoute((body, request) => resetPassword(body, request));
