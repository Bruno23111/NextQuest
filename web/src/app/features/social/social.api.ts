import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { API_BASE_URL } from '../../core/config/api.config';
import { CatalogGame, GameStatus, PagedResult } from '../../core/models/api.models';

export interface Friend {
  id: string;
  displayName: string;
  status: 'friend' | 'incoming' | 'outgoing';
  avatarUrl?: string | null;
}

export interface FriendGame {
  id: string;
  title: string;
  platform: string;
  status: GameStatus;
  rawgId: number | null;
  coverUrl: string | null;
}

export interface FriendProfile {
  displayName: string;
  bio: string | null;
  avatarUrl: string | null;
  headerUrl: string | null;
  playing: FriendGame[];
  library: PagedResult<FriendGame>;
  wishlist: PagedResult<CatalogGame>;
}

@Injectable({ providedIn: 'root' })
export class SocialApi {
  private readonly http = inject(HttpClient);
  private readonly base = inject(API_BASE_URL);

  friends() {
    return this.http.get<{ code: string; connections: Friend[] }>(this.base + '/friends');
  }

  profile(id: string, page: number, wishlistPage: number) {
    return this.http.get<FriendProfile>(this.base + '/friends/' + encodeURIComponent(id), {
      params: { page, wishlistPage },
    });
  }

  request(code: string) {
    return this.http.put<void>(this.base + '/friends/request', { code });
  }

  rotateCode() {
    return this.http.post<{ code: string }>(this.base + '/friends/code/rotate', null);
  }

  accept(id: string) {
    return this.http.put<void>(this.base + '/friends/' + encodeURIComponent(id) + '/accept', null);
  }

  remove(id: string) {
    return this.http.delete<void>(this.base + '/friends/' + encodeURIComponent(id));
  }

  wishIds() {
    return this.http.get<number[]>(this.base + '/wishlist/ids');
  }

  wishlist(page: number) {
    return this.http.get<PagedResult<CatalogGame>>(this.base + '/wishlist', { params: { page } });
  }

  setWish(id: number, enabled: boolean) {
    const url = this.base + '/wishlist/' + id;
    return enabled ? this.http.put<void>(url, null) : this.http.delete<void>(url);
  }
}
