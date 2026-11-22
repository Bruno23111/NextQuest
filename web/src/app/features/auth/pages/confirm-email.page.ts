import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { AuthStore } from '../../../core/auth/auth.store';
import { parseApiError } from '../../../core/errors/problem-details';
import { FeedbackBannerComponent } from '../../../shared/components/feedback-banner.component';
import { AuthLayoutComponent } from '../components/auth-layout.component';

@Component({
  selector: 'app-confirm-email-page',
  standalone: true,
  imports: [RouterLink, AuthLayoutComponent, FeedbackBannerComponent],
  template: `
    <app-auth-layout
      title="Confirmação de e-mail"
      subtitle="Validando seu link de ativação"
    >
      <app-feedback-banner [message]="errorMessage()" tone="error" />
      <app-feedback-banner [message]="successMessage()" tone="success" />

      @if (loading()) {
        <p class="status-text">Confirmando seu e-mail...</p>
      }

      <a routerLink="/auth/login" class="nq-btn nq-btn--primary">Ir para o login</a>
    </app-auth-layout>
  `,
  styles: `
    .status-text {
      margin: 0;
      color: var(--text-secondary);
    }
  `,
})
export class ConfirmEmailPageComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly auth = inject(AuthStore);

  protected readonly loading = signal(true);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly successMessage = signal<string | null>(null);

  ngOnInit(): void {
    const userId = this.route.snapshot.queryParamMap.get('userId');
    const code = this.route.snapshot.queryParamMap.get('code');

    if (!userId || !code) {
      this.loading.set(false);
      this.errorMessage.set('Link de confirmação inválido ou incompleto.');
      return;
    }

    this.auth.confirmEmail(userId, code).subscribe({
      next: (msg) => {
        this.loading.set(false);
        this.successMessage.set(msg || 'E-mail confirmado com sucesso!');
      },
      error: (err) => {
        this.loading.set(false);
        this.errorMessage.set(parseApiError(err).message);
      },
    });
  }
}
