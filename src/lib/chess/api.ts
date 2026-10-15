import { serviceRequest } from '../library/api';
export interface Match {
  id: string;
  nickname: string;
  status: 'waiting' | 'active' | 'finished' | 'cancelled' | 'expired';
  fen: string;
  pgn: string;
  version: number;
  result: string;
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
  return response.status === 204 ? (undefined as T) : response.json();
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
