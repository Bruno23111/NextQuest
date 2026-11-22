import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthStore } from '../../../core/auth/auth.store';
import { parseApiError } from '../../../core/errors/problem-details';
import { FeedbackBannerComponent } from '../../../shared/components/feedback-banner.component';
import { AuthLayoutComponent } from '../components/auth-layout.component';

@Component({
  selector: 'app-login-page',
  standalone: true,
  imports: [FormsModule, RouterLink, AuthLayoutComponent, FeedbackBannerComponent],
  template: `
    <app-auth-layout
      title="Entrar no NextQuest"
      subtitle="Gerencie seu backlog, catálogo RAWG e conquistas Steam"
    >
      <app-feedback-banner [message]="errorMessage()" tone="error" />

      <form class="auth-form" (ngSubmit)="submit()">
        <div class="nq-field">
          <label for="email">E-mail</label>
          <input id="email" name="email" type="email" [(ngModel)]="email" required autocomplete="email" />
        </div>

        <div class="nq-field">
          <label for="password">Senha</label>
          <input
            id="password"
            name="password"
            type="password"
            [(ngModel)]="password"
            required
            autocomplete="current-password"
          />
        </div>

        <button type="submit" class="nq-btn nq-btn--primary" [disabled]="loading()">
          <span class="ms-icon" aria-hidden="true">login</span>
          {{ loading() ? 'Entrando...' : 'Entrar' }}
        </button>
      </form>

      <div class="divider"><span>ou</span></div>

      <button
        type="button"
        class="nq-btn nq-btn--secondary"
        [disabled]="steamLoading()"
        (click)="loginWithSteam()"
      >
        <span class="ms-icon" aria-hidden="true">sports_esports</span>
        {{ steamLoading() ? 'Conectando à Steam...' : 'Entrar com Steam' }}
      </button>

      <div class="auth-links">
        <a routerLink="/auth/register">Criar conta</a>
        <a routerLink="/auth/forgot-password">Esqueci minha senha</a>
      </div>
    </app-auth-layout>
  `,
  styles: `
    .auth-form {
      display: flex;
      flex-direction: column;
      gap: 14px;
    }

    .divider {
      display: flex;
      align-items: center;
      gap: 12px;
      color: var(--text-muted);
      font-size: 0.8rem;

      &::before,
      &::after {
        content: '';
        flex: 1;
        height: 1px;
        background: var(--border-subtle);
      }
    }

    .auth-links {
      display: flex;
      justify-content: space-between;
      font-size: 0.86rem;
    }
  `,
})
export class LoginPageComponent {
  private readonly auth = inject(AuthStore);
  private readonly router = inject(Router);

  protected email = '';
  protected password = '';
  protected readonly loading = signal(false);
  protected readonly steamLoading = signal(false);
  protected readonly errorMessage = signal<string | null>(null);

  protected submit(): void {
    this.errorMessage.set(null);
    this.loading.set(true);

    this.auth.login({ email: this.email.trim(), password: this.password }).subscribe({
      next: () => {
        this.loading.set(false);
        void this.router.navigate(['/backlog']);
      },
      error: (err) => {
        this.loading.set(false);
        this.errorMessage.set(parseApiError(err).message);
      },
    });
  }

  protected async loginWithSteam(): Promise<void> {
    this.errorMessage.set(null);
    this.steamLoading.set(true);
    try {
      const url = await this.auth.beginSteamFlow('login');
      window.location.assign(url);
    } catch (err) {
      this.steamLoading.set(false);
      this.errorMessage.set(parseApiError(err).message);
    }
  }
}
