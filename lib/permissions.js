import { get, post } from '@/lib/api';

function b64ToUint8(s) {
  const pad = '='.repeat((4 - (s.length % 4)) % 4);
  const base64 = (s + pad).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export async function getMicrophoneStatus() {
  if (typeof window === 'undefined') return 'unsupported';
  if (!navigator?.mediaDevices?.getUserMedia) return 'unsupported';
  if (navigator?.permissions?.query) {
    try {
      const p = await navigator.permissions.query({ name: 'microphone' });
      return p.state; // 'granted' | 'denied' | 'prompt'
    } catch {
      // Some browsers throw on microphone query
    }
  }
  return 'prompt';
}

export async function getCameraStatus() {
  if (typeof window === 'undefined') return 'unsupported';
  if (!navigator?.mediaDevices?.getUserMedia) return 'unsupported';
  if (navigator?.permissions?.query) {
    try {
      const p = await navigator.permissions.query({ name: 'camera' });
      return p.state; // 'granted' | 'denied' | 'prompt'
    } catch {
      // Some browsers throw on camera query
    }
  }
  return 'prompt';
}

export async function getNotificationStatus() {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported';
  return Notification.permission; // 'granted' | 'denied' | 'default'
}

export async function getAllPermissions() {
  const [mic, cam, notif] = await Promise.all([
    getMicrophoneStatus(),
    getCameraStatus(),
    getNotificationStatus(),
  ]);
  return {
    microphone: mic,
    camera: cam,
    notifications: notif === 'default' ? 'prompt' : notif,
  };
}

export async function requestMicrophone() {
  if (!navigator?.mediaDevices?.getUserMedia) {
    throw new Error('Microphone is not supported in this browser.');
  }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach((track) => track.stop());
    return 'granted';
  } catch (err) {
    if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
      return 'denied';
    }
    throw err;
  }
}

export async function requestCamera() {
  if (!navigator?.mediaDevices?.getUserMedia) {
    throw new Error('Camera is not supported in this browser.');
  }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    stream.getTracks().forEach((track) => track.stop());
    return 'granted';
  } catch (err) {
    if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
      return 'denied';
    }
    throw err;
  }
}

export async function requestNotifications() {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    throw new Error('Notifications are not supported in this browser.');
  }
  const result = await Notification.requestPermission();
  if (result === 'granted' && 'serviceWorker' in navigator && 'PushManager' in window) {
    try {
      const h = await get('/health', { auth: false, family: false });
      if (h?.push && h?.vapidPublicKey) {
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: b64ToUint8(h.vapidPublicKey),
        });
        const j = sub.toJSON();
        await post('/me/push-subscriptions', {
          endpoint: j.endpoint,
          keys: { p256dh: j.keys.p256dh, auth: j.keys.auth },
          deviceName: (navigator.userAgentData?.platform || navigator.platform || 'Browser').slice(0, 60),
        });
      }
    } catch (e) {
      console.warn('Push subscription failed, but notification permission granted:', e);
    }
  }
  return result;
}
