type CdpCommand = {
  id: number;
  method: string;
  params?: Record<string, unknown>;
};

type CdpResponse = {
  id?: number;
  method?: string;
  params?: Record<string, unknown>;
  result?: Record<string, unknown>;
  error?: { message: string; code?: number };
};

export type CdpEventHandler = (params: Record<string, unknown>) => void | Promise<void>;

/** Minimal Chrome DevTools Protocol client over WebSocket. */
export class CdpConnection {
  private readonly ws: WebSocket;
  private nextId = 1;
  private readonly pending = new Map<
    number,
    { resolve: (value: Record<string, unknown>) => void; reject: (err: Error) => void }
  >();
  private readonly handlers = new Map<string, Set<CdpEventHandler>>();
  private closed = false;

  private constructor(ws: WebSocket) {
    this.ws = ws;
    ws.addEventListener('message', (event) => {
      void this.onMessage(String(event.data));
    });
    ws.addEventListener('close', () => {
      this.closed = true;
      for (const [, pending] of this.pending) {
        pending.reject(new Error('CDP connection closed'));
      }
      this.pending.clear();
      this.handlers.clear();
    });
  }

  static async connect(webSocketUrl: string): Promise<CdpConnection> {
    const ws = new WebSocket(webSocketUrl);
    await new Promise<void>((resolve, reject) => {
      ws.addEventListener('open', () => resolve(), { once: true });
      ws.addEventListener('error', () => reject(new Error(`CDP connect failed: ${webSocketUrl}`)), {
        once: true,
      });
    });
    return new CdpConnection(ws);
  }

  on(method: string, handler: CdpEventHandler): void {
    const set = this.handlers.get(method) ?? new Set();
    set.add(handler);
    this.handlers.set(method, set);
  }

  off(method: string, handler: CdpEventHandler): void {
    this.handlers.get(method)?.delete(handler);
  }

  async send(method: string, params?: Record<string, unknown>): Promise<Record<string, unknown>> {
    if (this.closed) {
      throw new Error(`CDP closed — cannot send ${method}`);
    }

    const id = this.nextId++;
    const payload: CdpCommand = { id, method, params };

    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify(payload));
    });
  }

  close(): void {
    if (!this.closed) {
      this.closed = true;
      this.ws.close();
    }
  }

  private async onMessage(raw: string): Promise<void> {
    const message = JSON.parse(raw) as CdpResponse;

    if (message.id !== undefined) {
      const pending = this.pending.get(message.id);
      if (!pending) {
        return;
      }
      this.pending.delete(message.id);
      if (message.error) {
        pending.reject(new Error(message.error.message));
      } else {
        pending.resolve(message.result ?? {});
      }
      return;
    }

    if (!message.method || !message.params) {
      return;
    }

    const handlers = this.handlers.get(message.method);
    if (!handlers?.size) {
      return;
    }

    for (const handler of handlers) {
      await handler(message.params);
    }
  }
}

export function cdpBaseUrl(httpUrl: string): string {
  return httpUrl.replace(/\/$/, '');
}

export async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { signal: AbortSignal.timeout(5_000) });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} for ${url}`);
  }
  return (await res.json()) as T;
}
