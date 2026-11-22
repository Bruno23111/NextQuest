import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../../../core/config/api.config';
import { UserProfile } from '../../../core/models/api.models';

@Injectable({ providedIn: 'root' })
export class ProfileApi {
  private readonly http = inject(HttpClient);
  private readonly apiBase = inject(API_BASE_URL);

  getProfile(): Observable<UserProfile> {
    return this.http.get<UserProfile>(`${this.apiBase}/profile`);
  }

  updateProfile(payload: FormData): Observable<UserProfile> {
    return this.http.put<UserProfile>(`${this.apiBase}/profile/images`, payload);
  }
}
