import { handle } from '@astrojs/cloudflare/handler';
import { cleanupStorage } from './server/services/travel';
export default {
  fetch: handle,
  scheduled(_event: ScheduledController, _env: Cloudflare.Env, context: ExecutionContext) {
    context.waitUntil(cleanupStorage());
  },
};
