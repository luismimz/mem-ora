// Hook «memora-push» (D-077): cada 15 minutos avisa en el móvil a quien tiene repasos vencidos, de 9:00 a 22:00 en
// Madrid y como mucho una vez cada 12 horas. Sin claves VAPID en el entorno, no hace nada.
import { reminderForUser } from './data';
import { ring, shouldRing, vapidFromEnv } from './lib';

export default ({ schedule }: { schedule: (cron: string, fn: () => Promise<void>) => void }, { database: db, logger }: { database: any; logger: any }) => {
  schedule('*/15 * * * *', async () => {
    const keys = vapidFromEnv(process.env);
    if (!keys) return;
    try {
      const now = Date.now();
      const subs: Array<{ id: string; user: string; endpoint: string; last_sent_at: string | null }> = await db('push_subscriptions').select('id', 'user', 'endpoint', 'last_sent_at');
      const byUser = new Map<string, typeof subs>();
      for (const s of subs) byUser.set(s.user, [...(byUser.get(s.user) ?? []), s]);
      let sent = 0;
      for (const [user, list] of byUser) {
        const last = Math.max(0, ...list.map((s) => (s.last_sent_at ? new Date(s.last_sent_at).getTime() : 0)));
        if (!shouldRing(last || null, now)) continue;
        if (!(await reminderForUser(db, user, now))) continue;
        for (const s of list) {
          const r = await ring(s.endpoint, keys);
          if (r === 'gone') await db('push_subscriptions').where({ id: s.id }).delete();
          else if (r === 'ok') { await db('push_subscriptions').where({ id: s.id }).update({ last_sent_at: new Date(now) }); sent += 1; }
        }
      }
      if (sent) logger.info(`[memora-push] ${sent} avisos de repaso enviados`);
    } catch (e) {
      logger.error(e, '[memora-push]');
    }
  });
};
