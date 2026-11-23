import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { Observable, finalize, switchMap } from 'rxjs';
import { parseApiError } from '../../core/errors/problem-details';
import { FeedbackBannerComponent } from '../../shared/components/feedback-banner.component';
import { DiscordApi, DiscordConnection } from './discord.api';

const STATE_KEY = 'nextquest.discord.oauth.state';

@Component({
  selector: 'app-discord-settings',
  standalone: true,
  imports: [FeedbackBannerComponent],
  template: `
    <section class="nq-bento-card integrations-card">
      <div class="nq-bento-header">
        <div>
          <h2>Integrações</h2>
          <p class="integrations-subtitle">Conecte serviços externos ao seu perfil</p>
        </div>

      </div>

      <ng-content />

      @if (connection(); as discord) {
        <div class="integration-box">
          <div class="integration-box__head">
            <div class="integration-badge" [class.integration-badge--avatar]="!!discord.avatarUrl">
              @if (discord.avatarUrl) {
                <img [src]="discord.avatarUrl" [alt]="discord.name || 'Discord'" />
              } @else {
                <span class="ms-icon" aria-hidden="true">forum</span>
              }
            </div>

            <div class="integration-box__info">
              <div class="integration-box__title">
                <h3>Discord</h3>
                @if (discord.name) {
                  <span class="nq-chip nq-chip--accent">{{ discord.name }}</span>
                }
              </div>
              <p>
                {{
                  discord.configured
                    ? 'Canal de publicação configurado.'
                    : 'Nenhum canal de publicação configurado.'
                }}
              </p>
            </div>
          </div>

          @if (!discord.oauthEnabled) {
            <app-feedback-banner
              message="O vínculo com Discord ainda aguarda configuração no servidor."
              tone="info"
            />
          }

          <div class="actions">
            @if (!discord.name) {
              <button
                type="button"
                class="nq-btn nq-btn--primary"
                [disabled]="busy() || !discord.oauthEnabled"
                (click)="connect(false)"
              >
                <span class="ms-icon" aria-hidden="true">link</span>
                Conectar Discord
              </button>
            } @else {
              <button
                type="button"
                class="nq-btn nq-btn--primary"
                [disabled]="busy() || !discord.oauthEnabled"
                (click)="connect(true)"
              >
                <span class="ms-icon" aria-hidden="true">tag</span>
                {{ discord.configured ? 'Trocar canal' : 'Escolher canal' }}
              </button>
            }

            @if (discord.configured) {
              <button
                type="button"
                class="nq-btn nq-btn--ghost"
                [disabled]="busy()"
                (click)="removeChannel()"
              >
                <span class="ms-icon" aria-hidden="true">link_off</span>
                Remover canal
              </button>
            }

            @if (discord.name) {
              <button
                type="button"
                class="nq-btn nq-btn--danger"
                [disabled]="busy()"
                (click)="disconnect()"
              >
                <span class="ms-icon" aria-hidden="true">logout</span>
                Desvincular Discord
              </button>
            }
          </div>
        </div>
      }

      @if (busy()) {
        <p class="processing-note" role="status">
          <span class="ms-icon" aria-hidden="true">sync</span>
          Processando conexão…
        </p>
      }

      <app-feedback-banner [message]="message() || null" tone="success" />
      <app-feedback-banner [message]="error() || null" tone="error" />
    </section>
  `,
  styles: `
    .integrations-card {
      gap: 16px;
    }

    .integrations-subtitle {
      margin: 4px 0 0;
      font-size: 0.84rem;
      color: var(--text-muted);
    }



    .integration-box {
      padding: 16px;
      border-radius: var(--radius-lg);
      background: var(--bg-surface);
      border: 1px solid var(--border-subtle);
      display: flex;
      flex-direction: column;
      gap: 14px;
    }

    .integration-box__head {
      display: flex;
      align-items: center;
      gap: 14px;
    }

    .integration-badge {
      width: 46px;
      height: 46px;
      border-radius: 14px;
      flex-shrink: 0;
      display: grid;
      place-items: center;
      background: rgba(88, 101, 242, 0.16);
      border: 1px solid rgba(88, 101, 242, 0.4);
      color: #a5b4fc;
      overflow: hidden;

      img {
        width: 100%;
        height: 100%;
        object-fit: cover;
        display: block;
      }
    }

    .integration-badge--avatar {
      border-radius: 50%;
      border-color: var(--accent-primary);
    }

    .integration-box__info {
      min-width: 0;
      flex: 1;

      p {
        margin: 4px 0 0;
        color: var(--text-secondary);
        font-size: 0.86rem;
      }
    }

    .integration-box__title {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px;

      h3 {
        margin: 0;
        font-size: 1rem;
      }
    }

    .actions {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px;
    }

    .processing-note {
      margin: 0;
      display: inline-flex;
      align-items: center;
      gap: 8px;
      color: var(--text-secondary);
      font-size: 0.86rem;

      .ms-icon {
        font-size: 18px;
        color: var(--accent-cyan);
      }
    }
  `,
})
export class DiscordSettingsComponent implements OnInit {
  private readonly api = inject(DiscordApi);
  private readonly destroyRef = inject(DestroyRef);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly connection = signal<DiscordConnection | null>(null);
  protected readonly busy = signal(true);
  protected readonly message = signal('');
  protected readonly error = signal('');

  ngOnInit(): void {
    const params = this.route.snapshot.queryParamMap;
    if (!params.has('code') && !params.has('error')) {
      this.load();
      return;
    }

    const code = params.get('code');
    const state = params.get('state');
    const expectedState = sessionStorage.getItem(STATE_KEY);
    sessionStorage.removeItem(STATE_KEY);
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { code: null, state: null, error: null, error_description: null, guild_id: null, iss: null },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });

    const issuer = params.get('iss');
    if (params.has('error') || !code || !state || state !== expectedState ||
        (issuer !== null && issuer !== 'https://discord.com')) {
      this.error.set(params.has('error') ? 'Autorização do Discord cancelada ou recusada.' : 'Autorização Discord inválida.');
      this.load();
      return;
    }

    this.update(this.api.complete(code, state), 'Conexão com Discord atualizada.');
  }

  protected connect(chooseChannel: boolean): void {
    if (this.busy()) return;
    this.busy.set(true);
    this.error.set('');
    this.message.set('');
    this.api.start(chooseChannel).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: ({ authorizationUrl }) => {
        const url = new URL(authorizationUrl);
        const state = url.searchParams.get('state');
        if (url.origin !== 'https://discord.com' || !state) {
          this.busy.set(false);
          this.error.set('URL de autorização do Discord inválida.');
          return;
        }
        sessionStorage.setItem(STATE_KEY, state);
        window.location.assign(url.href);
      },
      error: error => {
        this.busy.set(false);
        this.error.set(parseApiError(error).message);
      },
    });
  }

  protected removeChannel(): void {
    this.update(this.api.disconnect(), 'Canal removido.');
  }

  protected disconnect(): void {
    this.update(this.api.disconnectAccount(), 'Discord desvinculado.');
  }

  private load(): void {
    this.api.status().pipe(takeUntilDestroyed(this.destroyRef), finalize(() => this.busy.set(false)))
      .subscribe({
        next: connection => this.connection.set(connection),
        error: error => this.error.set(parseApiError(error).message),
      });
  }

  private update(request: Observable<void>, message: string): void {
    this.busy.set(true);
    this.error.set('');
    this.message.set('');
    request.pipe(
      switchMap(() => this.api.status()),
      takeUntilDestroyed(this.destroyRef),
      finalize(() => this.busy.set(false)),
    ).subscribe({
      next: connection => {
        this.connection.set(connection);
        this.message.set(message);
      },
      error: error => {
        this.error.set(parseApiError(error).message);
        if (!this.connection()) this.load();
      },
    });
  }
}
