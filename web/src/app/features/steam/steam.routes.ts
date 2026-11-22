import { Routes } from '@angular/router';
import { SteamAchievementsPageComponent } from './pages/steam-achievements.page';
import { SteamLibraryPageComponent } from './pages/steam-library.page';

export const STEAM_ROUTES: Routes = [
  { path: '', component: SteamLibraryPageComponent },
  { path: ':appId', component: SteamAchievementsPageComponent },
];
