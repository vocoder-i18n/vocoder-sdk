import { mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';

export interface AuthData {
  token: string;
  apiUrl: string;
  userId: string;
  email: string;
  name: string | null;
  createdAt: string;
}

function getAuthFilePath(): string {
  return join(homedir(), '.config', 'vocoder', 'auth.json');
}

export function readAuthData(): AuthData | null {
  const filePath = getAuthFilePath();
  try {
    const raw = readFileSync(filePath, 'utf8');
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    const data = parsed as Partial<AuthData>;
    if (
      typeof data.token !== 'string' ||
      typeof data.apiUrl !== 'string' ||
      typeof data.userId !== 'string' ||
      typeof data.email !== 'string' ||
      typeof data.createdAt !== 'string'
    ) {
      return null;
    }
    return {
      token: data.token,
      apiUrl: data.apiUrl,
      userId: data.userId,
      email: data.email,
      name: typeof data.name === 'string' ? data.name : null,
      createdAt: data.createdAt,
    };
  } catch {
    return null;
  }
}

export function writeAuthData(data: AuthData): void {
  const filePath = getAuthFilePath();
  const dir = dirname(filePath);
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  writeFileSync(filePath, JSON.stringify(data, null, 2), { mode: 0o600 });
}

export function clearAuthData(): void {
  const filePath = getAuthFilePath();
  try {
    unlinkSync(filePath);
  } catch {
    // Already gone — that's fine
  }
}
