import { HttpClient } from '@angular/common/http';
import { Component, DestroyRef, OnInit, inject, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { finalize } from 'rxjs';
import { API_BASE_URL } from '../../core/config/api.config';
import { parseApiError } from '../../core/errors/problem-details';
import { FeedbackBannerComponent } from '../../shared/components/feedback-banner.component';

interface PsnPreview {
  previewId: string;
  truncated: boolean;
  titles: {
    id: string;
    title: string;
    platform: string;
    trophies: { bronze: number; silver: number; gold: number; platinum: number } | null;
  }[];
}

interface PsnImportResult {
  added: number;
  updated: number;
  skipped: number;
}

@Component({
  selector: 'app-psn-sync',
  standalone: true,
  imports: [FeedbackBannerComponent],
  template: `
    <section class="nq-card psn-sync-card">
      <div class="psn-sync-card__header">
        <div class="psn-sync-card__title-group">
          <div class="psn-sync-card__icon" aria-hidden="true">
            <span class="ms-icon">sync</span>
          </div>
          <div>
            <h2>Sincronizar com a PSN</h2>
            <p>Consulte os jogos da lista de troféus da sua conta e escolha o que importar.</p>
          </div>
        </div>
      </div>

      @if (secureContext) {
        @if (oauthAvailable()) {
          <div>
            <button type="button" class="nq-btn nq-btn--primary" [disabled]="busy()" (click)="connect()">
              Conectar conta PSN
            </button>
          </div>
        }
        <form class="psn-sync-form" (submit)="preview($event, token)">
          <div class="nq-field psn-sync-form__field">
            <label for="psn-token">Token de acesso PSN</label>
            <input
              #token
              id="psn-token"
              type="password"
              maxlength="4096"
              required
              placeholder="Cole um token de acesso"
              autocomplete="off"
              autocapitalize="off"
              spellcheck="false"
              [disabled]="busy()"
            />
          </div>

          <button type="submit" class="nq-btn nq-btn--secondary" [disabled]="busy()">
            <span class="ms-icon" aria-hidden="true">cloud_download</span>
            Consultar PSN
          </button>
        </form>

        <small class="psn-sync-hint">
          <span class="ms-icon" aria-hidden="true">lock</span>
          Use um token de acesso válido. Ele é usado nesta consulta e não fica salvo.
        </small>
      } @else {
        <app-feedback-banner
          [inline]="true"
          tone="info"
          message="Abra o NextQuest por HTTPS ou em localhost para consultar a PSN."
        />
      }

      <app-feedback-banner [message]="error()" tone="error" [inline]="true" />

      @if (busy()) {
        <div class="psn-sync-status" role="status">
          <span class="ms-icon psn-sync-status__icon" aria-hidden="true">hourglass_top</span>
          <span>Processando…</span>
        </div>
      }

      @if (result(); as current) {
        <div class="psn-sync-preview">
          @if (current.titles.length) {
            <div class="psn-sync-preview__toolbar">
              <div class="psn-sync-preview__counts">
                <span class="nq-chip">{{ current.titles.length }} encontrados</span>
                <span class="nq-chip nq-chip--accent">{{ selected().size }} selecionados</span>
                @if (current.truncated) {
                  <span class="nq-chip psn-chip--warn">Prévia limitada a 500 títulos</span>
                }
              </div>

              <div class="psn-sync-preview__actions">
                <button
                  type="button"
                  class="nq-btn nq-btn--secondary psn-sync-preview__btn"
                  [disabled]="busy()"
                  (click)="selectAll(current)"
                >
                  <span class="ms-icon" aria-hidden="true">done_all</span>
                  Selecionar todos
                </button>
                <button
                  type="button"
                  class="nq-btn nq-btn--ghost psn-sync-preview__btn"
                  [disabled]="busy() || !selected().size"
                  (click)="selected.set(empty)"
                >
                  <span class="ms-icon" aria-hidden="true">close</span>
                  Limpar seleção
                </button>
              </div>
            </div>

            <ul class="psn-sync-list">
              @for (entry of current.titles; track entry.id) {
                <li>
                  <label class="psn-sync-item" [class.is-selected]="selected().has(entry.id)">
                    <input
                      type="checkbox"
                      [checked]="selected().has(entry.id)"
                      [disabled]="busy()"
                      (change)="toggle(entry.id, $event)"
                    />
                    <span class="psn-sync-item__title">{{ entry.title }}</span>
                    <span class="nq-chip psn-sync-item__platform">{{ entry.platform }}</span>
                    @if (entry.trophies; as counts) {
                      <span class="nq-chip psn-sync-item__trophies">
                        <span class="ms-icon" aria-hidden="true">emoji_events</span>
                        {{ counts.bronze + counts.silver + counts.gold + counts.platinum }}
                      </span>
                    }
                  </label>
                </li>
              }
            </ul>

            <div class="psn-sync-preview__footer">
              <button
                type="button"
                class="nq-btn nq-btn--primary"
                [disabled]="busy() || !selected().size"
                (click)="confirm(current)"
              >
                <span class="ms-icon" aria-hidden="true">download</span>
                Importar selecionados ({{ selected().size }})
              </button>
            </div>
          } @else {
            <p class="psn-sync-empty">A PSN não retornou títulos compatíveis para importar.</p>
          }
        </div>
      }

      @if (summary(); as saved) {
        <div class="psn-sync-summary" role="status">
          <span class="nq-chip psn-chip--success">
            <span class="ms-icon" aria-hidden="true">check_circle</span>
            Adicionados: {{ saved.added }}
          </span>
          <span class="nq-chip nq-chip--accent">
            <span class="ms-icon" aria-hidden="true">sync</span>
            Atualizados: {{ saved.updated }}
          </span>
          <span class="nq-chip">
            <span class="ms-icon" aria-hidden="true">layers</span>
            Ignorados: {{ saved.skipped }}
          </span>
        </div>
      }
    </section>
  `,
  styles: `
    .psn-sync-card {
      display: flex;
      flex-direction: column;
      gap: 14px;
    }

    .psn-sync-card__title-group {
      display: flex;
      align-items: center;
      gap: 14px;

      h2 {
        margin: 0 0 3px;
        font-size: 1.05rem;
        font-weight: 700;
      }

      p {
        margin: 0;
        font-size: 0.85rem;
        color: var(--text-muted);
      }
    }

    .psn-sync-card__icon {
      width: 40px;
      height: 40px;
      border-radius: 12px;
      display: grid;
      place-items: center;
      flex-shrink: 0;
      background: rgba(103, 201, 206, 0.14);
      color: var(--teal-light);
      border: 1px solid rgba(103, 201, 206, 0.35);
    }

    .psn-sync-form {
      display: grid;
      grid-template-columns: 1fr auto;
      gap: 12px;
      align-items: end;
    }

    .psn-sync-hint {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      color: var(--text-muted);
      font-size: 0.8rem;

      .ms-icon {
        font-size: 15px;
      }
    }

    .psn-sync-status {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      align-self: flex-start;
      padding: 8px 14px;
      border-radius: 999px;
      background: var(--bg-rail);
      border: 1px solid var(--border-subtle);
      color: var(--text-secondary);
      font-size: 0.86rem;
      font-weight: 500;
    }

    .psn-sync-status__icon {
      font-size: 18px;
      color: var(--accent-cyan);
    }

    .psn-sync-preview {
      display: flex;
      flex-direction: column;
      gap: 12px;
      padding-top: 14px;
      border-top: 1px solid var(--border-subtle);
    }

    .psn-sync-preview__toolbar {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
    }

    .psn-sync-preview__counts,
    .psn-sync-preview__actions {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px;
    }

    .psn-sync-preview__btn {
      padding: 7px 14px;
      font-size: 0.82rem;

      .ms-icon {
        font-size: 16px;
      }
    }

    .psn-sync-list {
      max-height: 22rem;
      overflow-y: auto;
      margin: 0;
      padding: 6px;
      list-style: none;
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      gap: 8px;
      border-radius: var(--radius-md);
      background: var(--bg-rail);
      border: 1px solid var(--border-subtle);
    }

    .psn-sync-item {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 10px 12px;
      border-radius: var(--radius-sm);
      border: 1px solid transparent;
      background: var(--bg-surface);
      cursor: pointer;
      transition: background-color 0.14s ease, border-color 0.14s ease;

      &:hover {
        background: var(--bg-surface-hover);
        border-color: var(--border-strong);
      }

      &.is-selected {
        background: color-mix(in srgb, var(--accent-primary) 10%, var(--bg-surface));
        border-color: var(--border-glow);
      }

      input[type='checkbox'] {
        width: 16px;
        height: 16px;
        margin: 0;
        flex-shrink: 0;
        accent-color: var(--accent-primary);
        cursor: pointer;
      }
    }

    .psn-sync-item__title {
      flex: 1;
      min-width: 0;
      font-size: 0.88rem;
      font-weight: 500;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .psn-sync-item__platform,
    .psn-sync-item__trophies {
      flex-shrink: 0;
      font-size: 0.72rem;
      padding: 2px 8px;

      .ms-icon {
        font-size: 13px;
        color: var(--color-warning);
      }
    }

    .psn-sync-preview__footer {
      display: flex;
      justify-content: flex-end;
    }

    .psn-sync-empty {
      margin: 0;
      color: var(--text-muted);
      font-size: 0.9rem;
    }

    .psn-sync-summary {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px;
      padding-top: 8px;
      border-top: 1px solid var(--border-subtle);

      .ms-icon {
        font-size: 15px;
      }
    }

    .psn-chip--success {
      color: var(--color-success);
      border-color: color-mix(in srgb, var(--color-success) 40%, transparent);
      background: color-mix(in srgb, var(--color-success) 10%, var(--bg-rail));
    }

    .psn-chip--warn {
      color: var(--color-warning);
      border-color: color-mix(in srgb, var(--color-warning) 40%, transparent);
      background: color-mix(in srgb, var(--color-warning) 10%, var(--bg-rail));
    }

    @media (max-width: 640px) {
      .psn-sync-form {
        grid-template-columns: 1fr;
      }

      .psn-sync-preview__footer button {
        width: 100%;
      }
    }
  `,
})
export class PsnSyncComponent implements OnInit {
  readonly imported = output<void>();
  private readonly http = inject(HttpClient);
  private readonly url = inject(API_BASE_URL) + '/playstation/sync';
  private readonly destroyRef = inject(DestroyRef);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  protected readonly secureContext = globalThis.isSecureContext;
  protected readonly result = signal<PsnPreview | null>(null);
  protected readonly summary = signal<PsnImportResult | null>(null);
  protected readonly busy = signal(false);
  protected readonly error = signal('');
  protected readonly empty: ReadonlySet<string> = new Set();
  protected readonly selected = signal(this.empty);
  protected readonly oauthAvailable = signal(false);

  ngOnInit(): void {
    if (window.location.protocol === 'https:') {
      this.http.get<{ available: boolean }>(this.url + '/oauth')
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({ next: ({ available }) => this.oauthAvailable.set(available), error: () => {} });
    }

    const params = this.route.snapshot.queryParamMap;
    const previewId = params.get('psnPreview');
    const oauthError = params.get('psnError');
    if (!previewId && !oauthError) return;

    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { psnPreview: null, psnError: null },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
    if (oauthError) {
      this.error.set(oauthError === 'limited' ? 'A PSN limitou as consultas. Aguarde e tente novamente.' :
        oauthError === 'denied' ? 'A conexão foi recusada ou cancelada.' :
          'A PSN não respondeu. Tente conectar novamente.');
      return;
    }

    if (previewId) {
      this.begin();
      this.http.get<PsnPreview>(`${this.url}/${encodeURIComponent(previewId)}/preview`).pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.busy.set(false)),
      ).subscribe({
        next: (result) => this.result.set(result),
        error: (error: unknown) => this.error.set(parseApiError(error).message),
      });
    }
  }

  protected connect(): void {
    if (this.busy() || !this.oauthAvailable()) return;
    this.begin();
    this.http.post<{ authorizationUrl: string }>(this.url + '/oauth/start', null).pipe(
      takeUntilDestroyed(this.destroyRef),
      finalize(() => this.busy.set(false)),
    ).subscribe({
      next: ({ authorizationUrl }) => window.location.assign(authorizationUrl),
      error: (error: unknown) => this.error.set(parseApiError(error).message),
    });
  }

  protected preview(event: SubmitEvent, field: HTMLInputElement): void {
    event.preventDefault();
    if (this.busy() || !this.secureContext) return;
    const accessToken = field.value.trim();
    field.value = '';
    if (!accessToken) return;

    this.begin();
    this.result.set(null);
    this.selected.set(this.empty);
    this.http
      .post<PsnPreview>(this.url + '/preview', { accessToken })
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.busy.set(false)),
      )
      .subscribe({
        next: (result) => this.result.set(result),
        error: (error: unknown) => this.error.set(parseApiError(error).message),
      });
  }

  protected selectAll(result: PsnPreview): void {
    this.selected.set(new Set(result.titles.map((title) => title.id)));
  }

  protected toggle(id: string, event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    const selected = new Set(this.selected());
    if (checked) selected.add(id);
    else selected.delete(id);
    this.selected.set(selected);
  }

  protected confirm(result: PsnPreview): void {
    if (this.busy() || !this.selected().size) return;
    this.begin();
    this.http
      .post<PsnImportResult>(`${this.url}/${result.previewId}/confirm`, {
        ids: [...this.selected()],
      })
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.busy.set(false)),
      )
      .subscribe({
        next: (summary) => {
          this.summary.set(summary);
          this.result.set(null);
          this.selected.set(this.empty);
          this.imported.emit();
        },
        error: (error: unknown) => this.error.set(parseApiError(error).message),
      });
  }

  private begin(): void {
    this.busy.set(true);
    this.error.set('');
    this.summary.set(null);
  }
}
