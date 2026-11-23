import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { API_BASE_URL } from '../../../core/config/api.config';
import { PagedResult } from '../../../core/models/api.models';

export interface GameReview {
  authorName: string;
  authorAvatarUrl: string | null;
  rating: number;
  text: string;
  updatedAt: string;
}

@Injectable({ providedIn: 'root' })
export class ReviewsApi {
  private readonly http = inject(HttpClient);
  private readonly games = inject(API_BASE_URL) + '/catalog/games';

  list(id: number, page: number) {
    return this.http.get<{ community: PagedResult<GameReview>; mine: GameReview | null }>(
      this.url(id), { params: { page } },
    );
  }

  save(id: number, rating: number, text: string) {
    return this.http.put<void>(this.url(id) + '/mine', { rating, text });
  }

  remove(id: number) {
    return this.http.delete<void>(this.url(id) + '/mine');
  }

  private url(id: number): string {
    return `${this.games}/${id}/reviews`;
  }
}
