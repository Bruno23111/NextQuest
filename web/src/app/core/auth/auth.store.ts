import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, tap } from 'rxjs';
import { API_BASE_URL } from '../config/api.config';
import {
  CredentialsRequest,
  EmailRequest,
  RedeemSteamRequest,
  ResetPasswordRequest,
  SessionResponse,
  StartSteamRequest,
  StartSteamResponse,
} from '../models/api.models';
import { SteamFlowMode, createPkcePair, savePendingSteamFlow } from './steam-pkce';

const STORAGE_KEY = 'nq_session';

@Injectable({ providedIn: 'root' })
export class AuthStore {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly apiBase = inject(API_BASE_URL);

  private readonly sessionSignal = signal<SessionResponse | null>(loadStoredSession());

  readonly session = this.sessionSignal.asReadonly();
  readonly isAuthenticated = computed(() => Boolean(this.sessionSignal()?.accessToken));

  get accessToken(): string | null {
    return this.sessionSignal()?.accessToken ?? null;
  }

  get refreshToken(): string | null {
    return this.sessionSignal()?.refreshToken ?? null;
  }

  login(payload: CredentialsRequest): Observable<SessionResponse> {
    return this.http
      .post<SessionResponse>(`${this.apiBase}/auth/login`, payload)
      .pipe(tap((session) => this.setSession(session)));
  }

  register(payload: CredentialsRequest): Observable<void> {
    return this.http.post<void>(`${this.apiBase}/auth/register`, payload);
  }

  confirmEmail(userId: string, code: string): Observable<string> {
    const params = new HttpParams().set('userId', userId).set('code', code);
    return this.http.get(`${this.apiBase}/auth/confirmEmail`, {
      params,
      responseType: 'text',
    });
  }

  resendConfirmation(payload: EmailRequest): Observable<void> {
    return this.http.post<void>(`${this.apiBase}/auth/resendConfirmationEmail`, payload);
  }

  forgotPassword(payload: EmailRequest): Observable<void> {
    return this.http.post<void>(`${this.apiBase}/auth/forgotPassword`, payload);
  }

  resetPassword(payload: ResetPasswordRequest): Observable<void> {
    return this.http.post<void>(`${this.apiBase}/auth/resetPassword`, payload);
  }

  refresh(): Observable<SessionResponse> {
    const refreshToken = this.refreshToken;
    return this.http
      .post<SessionResponse>(`${this.apiBase}/auth/refresh`, { refreshToken })
      .pipe(tap((session) => this.setSession(session)));
  }

  async beginSteamFlow(mode: SteamFlowMode): Promise<string> {
    const { codeVerifier, codeChallenge } = await createPkcePair();
    const endpoint = mode === 'link' ? `${this.apiBase}/auth/steam/link/start` : `${this.apiBase}/auth/steam/start`;
    const body: StartSteamRequest = { codeChallenge };

    const response = await new Promise<StartSteamResponse>((resolve, reject) => {
      this.http.post<StartSteamResponse>(endpoint, body).subscribe({
        next: resolve,
        error: reject,
      });
    });

    savePendingSteamFlow({
      state: response.state,
      codeVerifier,
      mode,
    });

    return response.authorizationUrl;
  }

  redeemSteamLogin(payload: RedeemSteamRequest): Observable<SessionResponse> {
    return this.http
      .post<SessionResponse>(`${this.apiBase}/auth/steam/token`, payload)
      .pipe(tap((session) => this.setSession(session)));
  }

  redeemSteamLink(payload: RedeemSteamRequest): Observable<void> {
    return this.http.post<void>(`${this.apiBase}/auth/steam/link`, payload);
  }

  logout(redirectToLogin = true): void {
    this.sessionSignal.set(null);
    localStorage.removeItem(STORAGE_KEY);
    if (redirectToLogin) {
      void this.router.navigate(['/auth/login']);
    }
  }

  private setSession(session: SessionResponse): void {
    this.sessionSignal.set(session);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  }
}

function loadStoredSession(): SessionResponse | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SessionResponse;
    return parsed?.accessToken && parsed?.refreshToken ? parsed : null;
  } catch {
    return null;
  }
}
