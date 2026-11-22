import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { BehaviorSubject, catchError, filter, switchMap, take, throwError } from 'rxjs';
import { AuthStore } from './auth.store';

let isRefreshing = false;
const refreshTokenSubject = new BehaviorSubject<string | null>(null);

const SKIP_REFRESH_PATHS = [
  '/auth/login',
  '/auth/register',
  '/auth/refresh',
  '/auth/forgotPassword',
  '/auth/resetPassword',
  '/auth/steam/start',
  '/auth/steam/token',
];

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthStore);
  const token = auth.accessToken;

  const authReq = token
    ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
    : req;

  return next(authReq).pipe(
    catchError((error: unknown) => {
      if (
        !(error instanceof HttpErrorResponse) ||
        error.status !== 401 ||
        SKIP_REFRESH_PATHS.some((path) => req.url.includes(path)) ||
        !auth.refreshToken
      ) {
        return throwError(() => error);
      }

      if (isRefreshing) {
        return refreshTokenSubject.pipe(
          filter((newToken): newToken is string => newToken !== null),
          take(1),
          switchMap((newToken) =>
            next(req.clone({ setHeaders: { Authorization: `Bearer ${newToken}` } })),
          ),
        );
      }

      isRefreshing = true;
      refreshTokenSubject.next(null);

      return auth.refresh().pipe(
        switchMap((session) => {
          isRefreshing = false;
          refreshTokenSubject.next(session.accessToken);
          return next(req.clone({ setHeaders: { Authorization: `Bearer ${session.accessToken}` } }));
        }),
        catchError((refreshErr) => {
          isRefreshing = false;
          auth.logout(true);
          return throwError(() => refreshErr);
        }),
      );
    }),
  );
};
