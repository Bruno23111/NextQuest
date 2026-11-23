import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { API_BASE_URL } from '../../core/config/api.config';
import { PagedResult } from '../../core/models/api.models';

export const VIDEO_CATEGORIES = [
  { value: 'gameplay', label: 'Gameplay' },
  { value: 'review', label: 'Análise' },
  { value: 'trailer', label: 'Trailer' },
  { value: 'other', label: 'Outros' },
] as const;

export type VideoCategory = (typeof VIDEO_CATEGORIES)[number]['value'];

export interface YouTubeVideo {
  id: string;
  title: string;
  channel: string;
  thumbnailUrl: string | null;
  canPlayHere: boolean;
}

export interface PublishedVideo extends YouTubeVideo {
  category: VideoCategory;
  rawgId: number | null;
  gameTitle: string | null;
}

export function youtubeWatchUrl(id: string): string {
  return 'https://www.youtube.com/watch?v=' + encodeURIComponent(id);
}

@Injectable({ providedIn: 'root' })
export class VideosApi {
  private readonly http = inject(HttpClient);
  private readonly base = inject(API_BASE_URL);

  list(page: number, q = '', category: VideoCategory | '' = '') {
    return this.http.get<PagedResult<PublishedVideo>>(this.base + '/videos', {
      params: { page, ...(q ? { q } : {}), ...(category ? { category } : {}) },
    });
  }

  search(q: string) {
    return this.http.get<{ items: YouTubeVideo[]; publishedIds: string[] }>(
      this.base + '/admin/videos/search', { params: { q } },
    );
  }

  publish(id: string, category: VideoCategory, rawgId: number | null) {
    return this.http.put<void>(this.base + '/admin/videos/' + encodeURIComponent(id), { category, rawgId });
  }

  remove(id: string) {
    return this.http.delete<void>(this.base + '/admin/videos/' + encodeURIComponent(id));
  }
}
