import { Routes } from '@angular/router';
import { guestGuard } from '../../core/auth/auth.guard';
import { ConfirmEmailPageComponent } from './pages/confirm-email.page';
import { ForgotPasswordPageComponent } from './pages/forgot-password.page';
import { LoginPageComponent } from './pages/login.page';
import { RegisterPageComponent } from './pages/register.page';
import { SteamCallbackPageComponent } from './pages/steam-callback.page';

export const AUTH_ROUTES: Routes = [
  { path: 'login', component: LoginPageComponent, canActivate: [guestGuard] },
  { path: 'register', component: RegisterPageComponent, canActivate: [guestGuard] },
  { path: 'forgot-password', component: ForgotPasswordPageComponent, canActivate: [guestGuard] },
  { path: 'confirm-email', component: ConfirmEmailPageComponent },
  { path: 'steam/callback', component: SteamCallbackPageComponent },
  { path: '', redirectTo: 'login', pathMatch: 'full' },
];
