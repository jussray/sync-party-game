export type RoomSession = {
  code: string;
  playerId: string;
  resumeToken: string;
  host: boolean;
};

export type PublicPlayer = {
  id: string;
  name: string;
  connected: boolean;
};

export type PublicRoomState = {
  gameVersion: number;
  code: string;
  phase: 'lobby' | 'choosing' | 'reveal' | 'results';
  hostId: string;
  players: PublicPlayer[];
  roundIndex: number;
  rounds: number;
  mode: { id: string; label: string; instruction: string } | null;
  prompt: { id: string; text: string; choices: string[] } | null;
  answers: Record<string, number | boolean>;
  scores: Record<string, number>;
  deadline: number | null;
  lastResults: {
    winners: string[];
    syncPercent: number;
    points: number;
  } | null;
  seq: number;
  stateHash: string | null;
};

export type RoomSocketMessage =
  | { type: 'STATE'; state: PublicRoomState; serverTime: number }
  | { type: 'PONG'; at: number }
  | { type: 'ERROR'; error?: string; message?: string };

function origin(): string {
  const value = process.env.EXPO_PUBLIC_SYNC_PARTY_ORIGIN?.trim().replace(/\/$/, '');
  if (!value) throw new Error('Sync Party mobile needs EXPO_PUBLIC_SYNC_PARTY_ORIGIN.');
  return value;
}

async function postJson(path: string, body: Record<string, unknown>): Promise<RoomSession> {
  const response = await fetch(`${origin()}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  const payload = await response.json().catch(() => ({})) as RoomSession & { error?: string };
  if (!response.ok) throw new Error(payload.error || `Sync Party request failed (${response.status}).`);
  return payload;
}

export function createRoom(name: string): Promise<RoomSession> {
  return postJson('/api/rooms/create', { name });
}

export function joinRoom(code: string, name: string): Promise<RoomSession> {
  return postJson(`/api/rooms/${code.toUpperCase()}/join`, { name });
}

export function openRoomSocket(session: RoomSession): WebSocket {
  const base = new URL(origin());
  base.protocol = base.protocol === 'https:' ? 'wss:' : 'ws:';
  base.pathname = `/api/rooms/${session.code}/ws`;
  base.searchParams.set('playerId', session.playerId);
  base.searchParams.set('token', session.resumeToken);
  return new WebSocket(base.toString());
}

export function sendRoomAction(socket: WebSocket | null, action: Record<string, unknown>): void {
  if (!socket || socket.readyState !== WebSocket.OPEN) throw new Error('Room connection is not open.');
  socket.send(JSON.stringify(action));
}
