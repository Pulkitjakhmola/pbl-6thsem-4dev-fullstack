import { WebSocketServer, WebSocket } from 'ws';
import { IncomingMessage } from 'http';
import { SessionManager } from './sessions.js';
import { logger } from '../index.js';

/**
 * Handles WS connections at /ws/runtime?sessionId=<id>
 * Clients subscribe to a session and receive live events.
 */
export function setupWebSocket(wss: WebSocketServer, sessions: SessionManager): void {
  wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
    const url = new URL(req.url ?? '', `http://localhost`);
    const sessionId = url.searchParams.get('sessionId');

    if (!sessionId) {
      ws.close(4000, 'sessionId required');
      return;
    }

    // Auto-create session if it doesn't exist
    let session = sessions.get(sessionId);
    if (!session) {
      session = sessions.create();
    }

    session.clients.add(ws);
    logger.info({ sessionId, clients: session.clients.size }, 'WS client connected');

    ws.on('message', (data) => {
      try {
        const msg = JSON.parse(data.toString()) as { type: string; payload: unknown };
        // Client can send events to be broadcast (e.g. manual alert triggers)
        session!.emit(msg.type, msg.payload);
      } catch {
        // ignore parse errors
      }
    });

    ws.on('close', () => {
      session!.clients.delete(ws);
      logger.info({ sessionId, clients: session!.clients.size }, 'WS client disconnected');
    });

    ws.send(JSON.stringify({ event: 'connected', sessionId, data: { status: 'ok' } }));
  });
}
