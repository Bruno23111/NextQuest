import { Routes } from '@angular/router';
import { authGuard } from './core/auth/auth.guard';
import { AppShellComponent } from './shared/layout/app-shell.component';

export const routes: Routes = [
  {
    path: 'auth',
    loadChildren: () => import('./features/auth/auth.routes').then((m) => m.AUTH_ROUTES),
  },
  {
    path: '',
    component: AppShellComponent,
    canActivate: [authGuard],
    children: [
      {
        path: 'backlog',
        loadChildren: () =>
          import('./features/backlog/backlog.routes').then((m) => m.BACKLOG_ROUTES),
      },
      {
        path: 'catalog',
        loadChildren: () =>
          import('./features/catalog/catalog.routes').then((m) => m.CATALOG_ROUTES),
      },
      {
        path: 'steam',
        loadChildren: () => import('./features/steam/steam.routes').then((m) => m.STEAM_ROUTES),
      },
      {
        path: 'profile',
        loadChildren: () =>
          import('./features/profile/profile.routes').then((m) => m.PROFILE_ROUTES),
      },
      { path: '', redirectTo: 'backlog', pathMatch: 'full' },
    ],
  },
  { path: '**', redirectTo: '' },
];
