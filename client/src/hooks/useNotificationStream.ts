import { useEffect, useRef, useState } from 'react';
import { API_BASE_URL } from '../api/client';

export interface LiveNotification {
  _id: string;
  title: string;
  message: string;
  type: string;
  actionUrl?: string;
  createdAt: string;
}

interface Handlers {
  onUnreadCount: (count: number) => void;
  onNotification?: (notification: LiveNotification) => void;
}

/** Event other pages (e.g. the Notification Center) listen to for a refresh. */
export const LIVE_NOTIFICATION_EVENT = 'fms:notification';

/**
 * Subscribes to the server's live notification stream (Server-Sent Events, cookie-authenticated).
 * The browser reconnects on its own; `connected` lets callers fall back to slow polling.
 */
export function useNotificationStream(handlers: Handlers) {
  const ref = useRef(handlers);
  useEffect(() => {
    ref.current = handlers;
  });
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (typeof EventSource === 'undefined') return;
    const source = new EventSource(`${API_BASE_URL}/notifications/stream`, { withCredentials: true });

    const count = (e: MessageEvent) => {
      const data = JSON.parse(e.data) as { unreadCount?: number };
      if (typeof data.unreadCount === 'number') ref.current.onUnreadCount(data.unreadCount);
    };
    source.addEventListener('ready', (e) => {
      setConnected(true);
      count(e as MessageEvent);
    });
    source.addEventListener('unread', (e) => count(e as MessageEvent));
    source.addEventListener('notification', (e) => {
      const data = JSON.parse((e as MessageEvent).data) as { notification: LiveNotification; unreadCount: number };
      ref.current.onUnreadCount(data.unreadCount);
      ref.current.onNotification?.(data.notification);
      window.dispatchEvent(new CustomEvent(LIVE_NOTIFICATION_EVENT, { detail: data.notification }));
    });
    source.onerror = () => {
      setConnected(false);
      // Signed out / session expired: stop retrying instead of hammering the server
      if (source.readyState === EventSource.CLOSED) source.close();
    };

    return () => source.close();
  }, []);

  return { connected };
}
