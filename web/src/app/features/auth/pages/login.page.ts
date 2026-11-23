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
    <app-auth-layout [loginBackground]="true"
      title="Entrar no NextQuest"
      subtitle="Gerencie seus Jogos e Backlog de forma simples e rápida"
    >
      <app-feedback-banner [message]="errorMessage()" tone="error" />

      <form class="auth-form" (ngSubmit)="submit()">
        <div class="nq-field">
          <label for="email">E-mail</label>
          <input id="email" name="email" type="email" [(ngModel)]="email" required autocomplete="username" />
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

        <label
          class="remember-login"
          [class.is-checked]="remember"
          [class.is-disabled]="loading() || steamLoading()"
        >
          <input
            class="remember-login__input"
            type="checkbox"
            name="remember"
            [(ngModel)]="remember"
            [disabled]="loading() || steamLoading()"
          />
          <span class="remember-login__box" aria-hidden="true">
            @if (remember) {
              <span class="ms-icon" aria-hidden="true">check</span>
            }
          </span>
          <span>Lembrar de mim neste navegador</span>
        </label>

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

    .remember-login {
      position: relative;
      display: inline-flex;
      align-items: center;
      gap: 10px;
      align-self: flex-start;
      padding: 4px 2px;
      font-size: 0.86rem;
      color: var(--text-secondary);
      cursor: pointer;
      user-select: none;
      transition: color 0.15s ease;

      &:hover:not(.is-disabled) {
        color: var(--text-primary);
      }

      &:has(:focus-visible) .remember-login__box {
        outline: 2px solid var(--accent-primary);
        outline-offset: 2px;
      }

      &.is-checked {
        color: var(--text-primary);

        .remember-login__box {
          background: var(--accent-primary);
          border-color: var(--accent-primary);
          color: #101113;
        }
      }

      &.is-disabled {
        opacity: 0.55;
        cursor: not-allowed;
      }
    }

    .remember-login__input {
      position: absolute;
      opacity: 0;
      width: 1px;
      height: 1px;
      pointer-events: none;
    }

    .remember-login__box {
      width: 18px;
      height: 18px;
      border-radius: 6px;
      border: 1px solid var(--border-strong);
      background: var(--bg-input);
      display: grid;
      place-items: center;
      flex-shrink: 0;
      transition: background-color 0.15s ease, border-color 0.15s ease;

      .ms-icon {
        font-size: 14px;
        font-weight: 700;
      }
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

  protected remember = true;
  protected email = '';
  protected password = '';
  protected readonly loading = signal(false);
  protected readonly steamLoading = signal(false);
  protected readonly errorMessage = signal<string | null>(null);

  protected submit(): void {
    if (this.loading() || this.steamLoading()) return;
    this.errorMessage.set(null);
    this.loading.set(true);

    this.auth.login({ email: this.email.trim(), password: this.password }, this.remember).subscribe({
      next: () => {
        this.loading.set(false);
        void this.router.navigate(['/week']);
      },
      error: (err) => {
        this.loading.set(false);
        this.errorMessage.set(parseApiError(err).message);
      },
    });
  }

  protected async loginWithSteam(): Promise<void> {
    if (this.loading() || this.steamLoading()) return;
    this.errorMessage.set(null);
    this.steamLoading.set(true);
    try {
      const url = await this.auth.beginSteamFlow('login', this.remember);
      window.location.assign(url);
    } catch (err) {
      this.steamLoading.set(false);
      this.errorMessage.set(parseApiError(err).message);
    }
  }
}
