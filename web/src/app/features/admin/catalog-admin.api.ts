import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { catchError, map, of } from 'rxjs';
import { API_BASE_URL } from '../../core/config/api.config';
import { CatalogGame, PagedResult } from '../../core/models/api.models';

interface CatalogSearchResult extends PagedResult<CatalogGame> {
  publishedIds: number[];
}

@Injectable({ providedIn: 'root' })
export class CatalogAdminApi {
  private readonly http = inject(HttpClient);
  private readonly url = inject(API_BASE_URL) + '/admin/catalog';

  hasAccess() {
    return this.http.get<void>(this.url + '/access').pipe(
      map(() => true),
      catchError(() => of(false)),
    );
  }

  search(q: string, page: number) {
    return this.http.get<CatalogSearchResult>(this.url + '/search', { params: { q, page } });
  }

  add(rawgId: number) {
    return this.http.put<CatalogGame>(this.url + '/games/' + rawgId, null);
  }
}
