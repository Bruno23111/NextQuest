import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthStore } from '../../../core/auth/auth.store';
import { parseApiError } from '../../../core/errors/problem-details';
import { FeedbackBannerComponent } from '../../../shared/components/feedback-banner.component';
import { AuthLayoutComponent } from '../components/auth-layout.component';

@Component({
  selector: 'app-register-page',
  standalone: true,
  imports: [FormsModule, RouterLink, AuthLayoutComponent, FeedbackBannerComponent],
  template: `
    <app-auth-layout
      title="Criar conta"
      subtitle="Cadastre seu e-mail para começar seu backlog"
    >
      <app-feedback-banner [message]="errorMessage()" tone="error" />
      <app-feedback-banner [message]="successMessage()" tone="success" />

      <form class="auth-form" (ngSubmit)="submit()">
        <div class="nq-field">
          <label for="reg-email">E-mail</label>
          <input id="reg-email" name="email" type="email" [(ngModel)]="email" required />
        </div>

        <div class="nq-field">
          <label for="reg-password">Senha</label>
          <input
            id="reg-password"
            name="password"
            type="password"
            [(ngModel)]="password"
            required
            minlength="8"
          />
        </div>

        <button type="submit" class="nq-btn nq-btn--primary" [disabled]="loading()">
          {{ loading() ? 'Criando conta...' : 'Cadastrar' }}
        </button>
      </form>

      <button
        type="button"
        class="nq-btn nq-btn--ghost"
        [disabled]="loading() || !email.trim()"
        (click)="resend()"
      >
        Reenviar e-mail de confirmação
      </button>

      <div class="auth-links">
        <a routerLink="/auth/login">Já tenho conta — Entrar</a>
      </div>
    </app-auth-layout>
  `,
  styles: `
    .auth-form {
      display: flex;
      flex-direction: column;
      gap: 14px;
    }

    .auth-links {
      text-align: center;
      font-size: 0.86rem;
    }
  `,
})
export class RegisterPageComponent {
  private readonly auth = inject(AuthStore);

  protected email = '';
  protected password = '';
  protected readonly loading = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly successMessage = signal<string | null>(null);

  protected submit(): void {
    this.errorMessage.set(null);
    this.successMessage.set(null);
    this.loading.set(true);

    this.auth.register({ email: this.email.trim(), password: this.password }).subscribe({
      next: () => {
        this.loading.set(false);
        this.successMessage.set('Conta criada! Verifique seu e-mail para confirmar o cadastro.');
      },
      error: (err) => {
        this.loading.set(false);
        this.errorMessage.set(parseApiError(err).message);
      },
    });
  }

  protected resend(): void {
    this.errorMessage.set(null);
    this.successMessage.set(null);
    this.loading.set(true);

    this.auth.resendConfirmation({ email: this.email.trim() }).subscribe({
      next: () => {
        this.loading.set(false);
        this.successMessage.set('Se o e-mail existir, enviamos um novo link de confirmação.');
      },
      error: (err) => {
        this.loading.set(false);
        this.errorMessage.set(parseApiError(err).message);
      },
    });
  }
}
