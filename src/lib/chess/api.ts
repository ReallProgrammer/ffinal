import { serviceRequest } from '../library/api';
export interface Match {
  id: string;
  nickname: string;
  status: 'waiting' | 'active' | 'finished' | 'cancelled' | 'expired';
  fen: string;
  pgn: string;
  version: number;
  result: string;
  timeControl: number;
  whiteMs: number;
  blackMs: number;
  serverNow: number;
  receivedAt?: number;
  createdAt: string;
  updatedAt: string;
  expiresAt: string;
}
export interface VisitorSession {
  id: string;
  token: string;
}
export async function chessRequest<T>(
  path: string,
  method = 'GET',
  body?: unknown,
  visitor?: VisitorSession,
): Promise<T> {
  const response = await serviceRequest(path, {
    method,
    ...(body ? { body: JSON.stringify(body) } : {}),
    ...(visitor ? { headers: { Authorization: 'Bearer ' + visitor.token } } : {}),
  });
  if (response.status === 204) return undefined as T;
  const value = await response.json();
  const stamp = (match: Record<string, unknown>) => ({ ...match, receivedAt: performance.now() });
  return (
    Array.isArray(value)
      ? value.map(stamp)
      : value.fen
        ? stamp(value)
        : value.match
          ? { ...value, match: stamp(value.match) }
          : value
  ) as T;
}
export function savedVisitor(): VisitorSession | null {
  try {
    return JSON.parse(sessionStorage.getItem('pc-chess-visitor') || 'null');
  } catch {
    return null;
  }
}
export function saveVisitor(value: VisitorSession | null) {
  try {
    if (value) sessionStorage.setItem('pc-chess-visitor', JSON.stringify(value));
    else sessionStorage.removeItem('pc-chess-visitor');
  } catch {
    /* Current-tab match remains usable. */
  }
}
