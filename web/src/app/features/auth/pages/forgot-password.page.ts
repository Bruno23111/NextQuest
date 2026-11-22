import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthStore } from '../../../core/auth/auth.store';
import { parseApiError } from '../../../core/errors/problem-details';
import { FeedbackBannerComponent } from '../../../shared/components/feedback-banner.component';
import { AuthLayoutComponent } from '../components/auth-layout.component';

@Component({
  selector: 'app-forgot-password-page',
  standalone: true,
  imports: [FormsModule, RouterLink, AuthLayoutComponent, FeedbackBannerComponent],
  template: `
    <app-auth-layout
      title="Recuperar senha"
      subtitle="Solicite o código por e-mail e defina uma nova senha"
    >
      <app-feedback-banner [message]="errorMessage()" tone="error" />
      <app-feedback-banner [message]="successMessage()" tone="success" />

      <form class="auth-form" (ngSubmit)="requestCode()">
        <div class="nq-field">
          <label for="fp-email">E-mail da conta</label>
          <input id="fp-email" name="email" type="email" [(ngModel)]="email" required />
        </div>

        <button type="submit" class="nq-btn nq-btn--secondary" [disabled]="loading()">
          Enviar código de recuperação
        </button>
      </form>

      <form class="auth-form" (ngSubmit)="applyReset()">
        <div class="nq-field">
          <label for="fp-code">Código recebido</label>
          <input id="fp-code" name="resetCode" type="text" [(ngModel)]="resetCode" required />
        </div>

        <div class="nq-field">
          <label for="fp-pass">Nova senha</label>
          <input
            id="fp-pass"
            name="newPassword"
            type="password"
            [(ngModel)]="newPassword"
            required
            minlength="8"
          />
        </div>

        <button type="submit" class="nq-btn nq-btn--primary" [disabled]="loading()">
          Redefinir senha
        </button>
      </form>

      <div class="auth-links">
        <a routerLink="/auth/login">Voltar ao login</a>
      </div>
    </app-auth-layout>
  `,
  styles: `
    .auth-form {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .auth-links {
      text-align: center;
      font-size: 0.86rem;
    }
  `,
})
export class ForgotPasswordPageComponent {
  private readonly auth = inject(AuthStore);

  protected email = '';
  protected resetCode = '';
  protected newPassword = '';
  protected readonly loading = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly successMessage = signal<string | null>(null);

  protected requestCode(): void {
    this.errorMessage.set(null);
    this.successMessage.set(null);
    this.loading.set(true);

    this.auth.forgotPassword({ email: this.email.trim() }).subscribe({
      next: () => {
        this.loading.set(false);
        this.successMessage.set('Se a conta existir, enviamos o código de redefinição por e-mail.');
      },
      error: (err) => {
        this.loading.set(false);
        this.errorMessage.set(parseApiError(err).message);
      },
    });
  }

  protected applyReset(): void {
    this.errorMessage.set(null);
    this.successMessage.set(null);
    this.loading.set(true);

    this.auth
      .resetPassword({
        email: this.email.trim(),
        resetCode: this.resetCode.trim(),
        newPassword: this.newPassword,
      })
      .subscribe({
        next: () => {
          this.loading.set(false);
          this.successMessage.set('Senha redefinida com sucesso. Você já pode entrar.');
        },
        error: (err) => {
          this.loading.set(false);
          this.errorMessage.set(parseApiError(err).message);
        },
      });
  }
}
