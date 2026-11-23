import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthStore } from '../../../core/auth/auth.store';
import { consumePendingSteamFlow } from '../../../core/auth/steam-pkce';
import { parseApiError } from '../../../core/errors/problem-details';
import { FeedbackBannerComponent } from '../../../shared/components/feedback-banner.component';
import { AuthLayoutComponent } from '../components/auth-layout.component';

@Component({
  selector: 'app-steam-callback-page',
  standalone: true,
  imports: [RouterLink, AuthLayoutComponent, FeedbackBannerComponent],
  template: `
    <app-auth-layout
      title="Autenticação Steam"
      subtitle="Concluindo validação com a API"
    >
      <app-feedback-banner [message]="errorMessage()" tone="error" />

      @if (loading()) {
        <p class="status-text">Validando resposta da Steam...</p>
      } @else if (errorMessage()) {
        <a routerLink="/auth/login" class="nq-btn nq-btn--secondary">Voltar ao login</a>
      }
    </app-auth-layout>
  `,
  styles: `
    .status-text {
      margin: 0;
      color: var(--text-secondary);
    }
  `,
})
export class SteamCallbackPageComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly auth = inject(AuthStore);

  protected readonly loading = signal(true);
  protected readonly errorMessage = signal<string | null>(null);

  ngOnInit(): void {
    const query = this.route.snapshot.queryParamMap;
    const state = query.get('state');
    const code = query.get('code');
    const steamError = query.get('error');

    if (steamError) {
      this.loading.set(false);
      this.errorMessage.set('Autenticação Steam cancelada ou recusada.');
      return;
    }

    if (!state || !code) {
      this.loading.set(false);
      this.errorMessage.set('Parâmetros de retorno Steam ausentes.');
      return;
    }

    const pending = consumePendingSteamFlow(state);
    if (!pending) {
      this.loading.set(false);
      this.errorMessage.set('Sessão PKCE da Steam expirada ou inválida. Tente novamente.');
      return;
    }

    const payload = { state, code, codeVerifier: pending.codeVerifier };
    if (pending.mode === 'link') {
      this.auth.redeemSteamLink(payload).subscribe({
        next: () => {
          this.loading.set(false);
          void this.router.navigate(['/backlog'], { queryParams: { collection: 'steam' } });
        },
        error: (err) => {
          this.loading.set(false);
          this.errorMessage.set(parseApiError(err).message);
        },
      });
      return;
    }

    this.auth.redeemSteamLogin(payload, pending.remember ?? true).subscribe({
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
}
