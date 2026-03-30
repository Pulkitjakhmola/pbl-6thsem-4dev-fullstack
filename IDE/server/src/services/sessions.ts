import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';

export interface Session {
  id: string;
  createdAt: Date;
  status: 'active' | 'stopped';
  clients: Set<import('ws').WebSocket>;
  emit(event: string, data: unknown): void;
}

export class SessionManager extends EventEmitter {
  private sessions = new Map<string, Session>();

  create(): Session {
    const id = uuidv4();
    const session: Session = {
      id,
      createdAt: new Date(),
      status: 'active',
      clients: new Set(),
      emit: (event: string, data: unknown) => {
        const payload = JSON.stringify({ event, data, sessionId: id });
        session.clients.forEach((ws) => {
          if (ws.readyState === 1 /* OPEN */) ws.send(payload);
        });
      },
    };
    this.sessions.set(id, session);
    return session;
  }

  get(id: string): Session | undefined {
    return this.sessions.get(id);
  }

  list() {
    return Array.from(this.sessions.values()).map((s) => ({
      id: s.id,
      status: s.status,
      createdAt: s.createdAt,
      clients: s.clients.size,
    }));
  }

  stop(id: string): boolean {
    const session = this.sessions.get(id);
    if (!session) return false;
    session.status = 'stopped';
    session.clients.forEach((ws) => ws.close());
    session.clients.clear();
    this.sessions.delete(id);
    return true;
  }
}
