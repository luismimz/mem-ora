// Aviso de repaso en el móvil (D-077): pedir permiso y suscribir este dispositivo. En iPhone solo funciona con Memora
// instalada en la pantalla de inicio (iOS 16.4+); si no, la app explica cómo hacerlo.
import { api } from './api';
import { deviceId } from './device';

export type PushState = 'unsupported' | 'ios-install' | 'off' | 'on' | 'denied';

const isIOS = () => /iPhone|iPad|iPod/.test(navigator.userAgent);
const standalone = () => window.matchMedia?.('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true;

export async function pushState(): Promise<PushState> {
  if (isIOS() && !standalone()) return 'ios-install';
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return 'unsupported';
  if (Notification.permission === 'denied') return 'denied';
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = await reg?.pushManager.getSubscription();
  return sub && Notification.permission === 'granted' ? 'on' : 'off';
}

function keyBytes(b64url: string): ArrayBuffer {
  const b64 = b64url.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (b64url.length % 4)) % 4);
  const bin = atob(b64);
  const out = new ArrayBuffer(bin.length);
  const view = new Uint8Array(out);
  for (let i = 0; i < bin.length; i += 1) view[i] = bin.charCodeAt(i);
  return out;
}

/** Pide permiso (debe llamarse desde un toque) y guarda la suscripción en el servidor. */
export async function enablePush(): Promise<PushState> {
  const { publicKey } = await api.pushKey();
  if (!publicKey) return 'unsupported';
  if ((await Notification.requestPermission()) !== 'granted') return 'denied';
  const reg = await navigator.serviceWorker.ready;
  const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(publicKey) }));
  await api.pushSubscribe(sub.toJSON(), deviceId());
  return 'on';
}
