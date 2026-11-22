import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../../../core/config/api.config';
import {
  BacklogGame,
  CreateGameRequest,
  GameStatus,
  PagedResult,
  UpdateGameRequest,
} from '../../../core/models/api.models';

@Injectable({ providedIn: 'root' })
export class BacklogApi {
  private readonly http = inject(HttpClient);
  private readonly apiBase = inject(API_BASE_URL);

  list(q?: string, status?: GameStatus | null, page = 1): Observable<PagedResult<BacklogGame>> {
    let params = new HttpParams().set('page', page);
    if (q?.trim()) params = params.set('q', q.trim());
    if (status) params = params.set('status', status);

    return this.http.get<PagedResult<BacklogGame>>(`${this.apiBase}/backlog`, { params });
  }

  find(id: string): Observable<BacklogGame> {
    return this.http.get<BacklogGame>(`${this.apiBase}/backlog/${id}`);
  }

  create(payload: CreateGameRequest): Observable<BacklogGame> {
    return this.http.post<BacklogGame>(`${this.apiBase}/backlog`, payload);
  }

  update(id: string, payload: UpdateGameRequest): Observable<BacklogGame> {
    return this.http.patch<BacklogGame>(`${this.apiBase}/backlog/${id}`, payload);
  }

  remove(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiBase}/backlog/${id}`);
  }
}
