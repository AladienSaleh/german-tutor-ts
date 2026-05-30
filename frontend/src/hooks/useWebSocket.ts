import { useRef, useState, useCallback, useEffect } from 'react';

export type WsStatus = 'disconnected' | 'connecting' | 'connected';

export interface IncomingMessage {
  type: string;
  text?: string;
  lang?: string;
  data?: string;
  timing?: { sttMs: number; ttsMs: number };
}

interface UseWebSocketOptions {
  onMessage: (msg: IncomingMessage) => void;
  onStatusChange?: (s: WsStatus) => void;
}

export function useWebSocket({ onMessage, onStatusChange }: UseWebSocketOptions) {
  const wsRef = useRef<WebSocket | null>(null);
  const [status, setStatus] = useState<WsStatus>('disconnected');
  const retryCount = useRef(0);
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const urlRef = useRef<string>('');
  const mountedRef = useRef(true);

  // Store callbacks in refs so they never trigger dependency cascades.
  // The "latest ref" pattern: effects/callbacks always call the current version.
  const onMessageRef = useRef(onMessage);
  const onStatusChangeRef = useRef(onStatusChange);
  useEffect(() => { onMessageRef.current = onMessage; });
  useEffect(() => { onStatusChangeRef.current = onStatusChange; });

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  // Stable reference — never changes, so no cascading effect re-runs.
  const updateStatus = useCallback((s: WsStatus) => {
    setStatus(s);
    onStatusChangeRef.current?.(s);
  }, []);

  const disconnect = useCallback(() => {
    if (retryTimer.current) clearTimeout(retryTimer.current);
    retryCount.current = 99;
    wsRef.current?.close(1000, 'user disconnect');
    wsRef.current = null;
    updateStatus('disconnected');
  }, [updateStatus]);

  const connect = useCallback((url: string) => {
    if (retryTimer.current) clearTimeout(retryTimer.current);
    if (wsRef.current) {
      // Detach handlers before closing to avoid triggering reconnect logic.
      wsRef.current.onclose = null;
      wsRef.current.onerror = null;
      wsRef.current.close(1000, 'reconnect');
      wsRef.current = null;
    }
    urlRef.current = url;
    retryCount.current = 0;

    function open() {
      if (!mountedRef.current) return;
      updateStatus('connecting');
      const ws = new WebSocket(urlRef.current);
      wsRef.current = ws;

      ws.onopen = () => {
        retryCount.current = 0;
        updateStatus('connected');
      };

      ws.onmessage = (ev) => {
        try { onMessageRef.current(JSON.parse(ev.data as string) as IncomingMessage); } catch { /* skip */ }
      };

      ws.onclose = (ev) => {
        if (!mountedRef.current) return;
        wsRef.current = null;
        updateStatus('disconnected');
        if (ev.code !== 1000 && ev.code !== 1001 && retryCount.current < 8) {
          const delay = Math.min(1000 * 2 ** retryCount.current, 30_000);
          retryCount.current++;
          retryTimer.current = setTimeout(open, delay);
        }
      };

      ws.onerror = () => { /* onclose will fire */ };
    }

    open();
  }, [updateStatus]);

  const send = useCallback((msg: object) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg));
    }
  }, []);

  // Only disconnect on actual unmount, not on every render.
  useEffect(() => () => { disconnect(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return { status, connect, disconnect, send };
}
