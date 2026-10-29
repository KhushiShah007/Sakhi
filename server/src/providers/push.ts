import webpush from 'web-push';

export interface PushSub { endpoint: string; keys: { p256dh: string; auth: string } }
export type PushResult = 'sent' | 'gone' | 'failed';
export interface PushProvider { name: string; publicKey: string; send(sub: PushSub, payload: { title: string; body: string; url: string }): Promise<PushResult> }

/** Web Push over VAPID. Active only when VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY are set; without them reminders simply stay off. */
export class WebPushProvider implements PushProvider {
  name = 'webpush';
  publicKey: string;
  constructor(cfg: { publicKey: string; privateKey: string; subject: string }, private sender: Pick<typeof webpush, 'sendNotification'> = webpush) {
    this.publicKey = cfg.publicKey;
    webpush.setVapidDetails(cfg.subject, cfg.publicKey, cfg.privateKey);
  }
  async send(sub: PushSub, payload: { title: string; body: string; url: string }): Promise<PushResult> {
    try { await this.sender.sendNotification(sub, JSON.stringify(payload), { TTL: 3600 }); return 'sent'; }
    catch (e) { const code = (e as { statusCode?: number }).statusCode; return code === 404 || code === 410 ? 'gone' : 'failed'; }
  }
}

export function pushFromEnv(env: NodeJS.ProcessEnv): PushProvider | null {
  if (!env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY) return null;
  try { return new WebPushProvider({ publicKey: env.VAPID_PUBLIC_KEY, privateKey: env.VAPID_PRIVATE_KEY, subject: env.VAPID_SUBJECT || 'mailto:admin@example.com' }); }
  catch { return null; } // a malformed key must not stop the server
}
