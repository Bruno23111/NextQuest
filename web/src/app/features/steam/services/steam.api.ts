import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../../../core/config/api.config';
import { SteamGameAchievements, SteamLibrary } from '../../../core/models/api.models';

@Injectable({ providedIn: 'root' })
export class SteamApi {
  private readonly http = inject(HttpClient);
  private readonly apiBase = inject(API_BASE_URL);

  getLibrary(): Observable<SteamLibrary> {
    return this.http.get<SteamLibrary>(`${this.apiBase}/steam/library`);
  }

  getAchievements(appId: number): Observable<SteamGameAchievements> {
    return this.http.get<SteamGameAchievements>(`${this.apiBase}/steam/games/${appId}/achievements`);
  }
}
