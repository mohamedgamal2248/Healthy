import { ok, route } from "@/server/http";
import { pushConfigured, vapidPublicKey } from "@/server/push";

/** Public VAPID key (safe to expose; it identifies the sender). Read at runtime, so no rebuild is needed to enable push. */
export const GET = route(async () => ok({ enabled: pushConfigured(), key: pushConfigured() ? vapidPublicKey() : null }));
