import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { API_BASE_URL } from '../../core/config/api.config';

export type DiscordShareTarget =
  | { gameId: string }
  | { appId: number; apiName: string };

export interface DiscordConnection {
  configured: boolean;
  oauthEnabled: boolean;
  name: string | null;
  avatarUrl: string | null;
}

@Injectable({ providedIn: 'root' })
export class DiscordApi {
  private readonly http = inject(HttpClient);
  private readonly base = inject(API_BASE_URL) + '/discord';

  status() {
    return this.http.get<DiscordConnection>(this.base);
  }

  start(chooseChannel: boolean) {
    return this.http.post<{ authorizationUrl: string }>(this.base + '/oauth/start', { chooseChannel });
  }

  complete(code: string, state: string) {
    return this.http.post<void>(this.base + '/oauth/complete', { code, state });
  }

  disconnectAccount() {
    return this.http.delete<void>(this.base + '/account');
  }

  configure(webhookUrl: string) {
    return this.http.put<void>(this.base, { webhookUrl });
  }

  disconnect() {
    return this.http.delete<void>(this.base);
  }

  invite(gameId: string, startsAt: string, message?: string) {
    return this.http.post<void>(this.base + '/games/' + gameId + '/invite', { startsAt, message });
  }

  share(target: DiscordShareTarget) {
    if ('gameId' in target) {
      return this.http.post<void>(this.base + '/games/' + target.gameId, null);
    }

    return this.http.post<void>(this.base + '/steam/' + target.appId + '/achievements', {
      apiName: target.apiName,
    });
  }
}
