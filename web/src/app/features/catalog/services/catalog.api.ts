import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../../../core/config/api.config';
import {
  BacklogGame,
  CatalogGame,
  ImportGameRequest,
  PagedResult,
} from '../../../core/models/api.models';

@Injectable({ providedIn: 'root' })
export class CatalogApi {
  private readonly http = inject(HttpClient);
  private readonly apiBase = inject(API_BASE_URL);

  popular(page = 1): Observable<PagedResult<CatalogGame>> {
    const params = new HttpParams().set('page', page);
    return this.http.get<PagedResult<CatalogGame>>(`${this.apiBase}/catalog/popular`, { params });
  }

  search(q: string, page = 1): Observable<PagedResult<CatalogGame>> {
    const params = new HttpParams().set('q', q.trim()).set('page', page);
    return this.http.get<PagedResult<CatalogGame>>(`${this.apiBase}/catalog/games`, { params });
  }

  importGame(payload: ImportGameRequest): Observable<BacklogGame> {
    return this.http.post<BacklogGame>(`${this.apiBase}/backlog/import`, payload);
  }
}
