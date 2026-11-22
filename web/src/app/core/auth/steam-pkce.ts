const STEAM_PENDING_KEY = 'nq_steam_pkce';

export type SteamFlowMode = 'login' | 'link';

export interface PendingSteamFlow {
  state: string;
  codeVerifier: string;
  mode: SteamFlowMode;
}

export async function createPkcePair(): Promise<{ codeVerifier: string; codeChallenge: string }> {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  const codeVerifier = toBase64Url(bytes);

  const encoded = new TextEncoder().encode(codeVerifier);
  const digest = await crypto.subtle.digest('SHA-256', encoded);
  const codeChallenge = toBase64Url(new Uint8Array(digest));

  return { codeVerifier, codeChallenge };
}

export function savePendingSteamFlow(flow: PendingSteamFlow): void {
  sessionStorage.setItem(STEAM_PENDING_KEY, JSON.stringify(flow));
}

export function consumePendingSteamFlow(expectedState: string): PendingSteamFlow | null {
  const raw = sessionStorage.getItem(STEAM_PENDING_KEY);
  sessionStorage.removeItem(STEAM_PENDING_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as PendingSteamFlow;
    return parsed.state === expectedState ? parsed : null;
  } catch {
    return null;
  }
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const b of bytes) {
    binary += String.fromCharCode(b);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
