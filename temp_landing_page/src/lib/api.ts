export const API_BASE_URL = 
  import.meta.env.VITE_API_BASE_URL ?? "";

export function getDiscordImageUrl(url: string | null | undefined): string | undefined {
  if (!url) return undefined;
  if (url.includes('cdn.discordapp.com') || url.includes('media.discordapp.net')) {
    return `${API_BASE_URL}/api/proxy/discord-image?url=${encodeURIComponent(url)}`;
  }
  return url;
}

export function getAuthToken(): string | null {
  return null;
}

export function setAuthToken(_token: string): void {
  return;
}

export function removeAuthToken(): void {
  return;
}

export async function apiFetch(endpoint: string, options: RequestInit = {}) {
  const headers = new Headers(options.headers || {});

  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
    credentials: 'include'
  });

  if (response.status === 401) {
    // If unauthorized, clear token
    // removeAuthToken();
  }

  return response;
}
