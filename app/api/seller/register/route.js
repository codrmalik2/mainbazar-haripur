import { registerSeller } from '@/lib/seller-signup';
import { jsonRoute } from '../handler';

// Step 3: save the shop as 'pending' (verified email only) and notify the admin
export const POST = jsonRoute((body, request) => registerSeller(body, request));
