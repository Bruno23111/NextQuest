import { inject } from '@angular/core';
import { Router, Routes } from '@angular/router';
import { map } from 'rxjs';
import { authGuard } from './core/auth/auth.guard';
import { AppShellComponent } from './shared/layout/app-shell.component';
import { CatalogAdminApi } from './features/admin/catalog-admin.api';

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
        path: 'friends',
        children: [
          {
            path: '',
            loadComponent: () => import('./features/social/friends.page').then(m => m.FriendsPage),
          },
          {
            path: ':id',
            loadComponent: () => import('./features/social/friend-profile.page').then(m => m.FriendProfilePage),
          },
        ],
      },
      {
        path: 'wishlist',
        loadComponent: () => import('./features/social/wishlist.page').then(m => m.WishlistPage),
      },
      {
        path: 'admin',
        canActivate: [() => {
          const router = inject(Router);
          return inject(CatalogAdminApi).hasAccess().pipe(
            map((allowed) => allowed || router.createUrlTree(['/backlog'])),
          );
        }],
        children: [
          {
            path: '',
            pathMatch: 'full',
            loadComponent: () => import('./features/admin/catalog-admin.page').then(m => m.CatalogAdminPage),
          },
          {
            path: 'deals',
            loadComponent: () => import('./features/admin/deals-admin.page').then(m => m.DealsAdminPage),
          },
        ],
      },
      {
        path: 'deals',
        loadComponent: () => import('./features/deals/deals.page').then(m => m.DealsPageComponent),
      },
      {
        path: 'playstation',
        loadComponent: () =>
          import('./features/playstation/playstation.page').then((m) => m.PlayStationPage),
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
