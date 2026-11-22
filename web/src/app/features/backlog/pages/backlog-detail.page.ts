import { DatePipe } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { parseApiError } from '../../../core/errors/problem-details';
import { BacklogGame, GameStatus } from '../../../core/models/api.models';
import { FeedbackBannerComponent } from '../../../shared/components/feedback-banner.component';
import { GameCoverComponent } from '../../../shared/components/game-cover.component';
import { StatusBadgeComponent } from '../../../shared/components/status-badge.component';
import { BacklogApi } from '../services/backlog.api';

interface StatusChoice {
  value: GameStatus;
  label: string;
  icon: string;
  colorVar: string;
}

const STATUS_CHOICES: StatusChoice[] = [
  { value: 'planned', label: 'Planejado', icon: 'bookmark_border', colorVar: 'var(--status-planned)' },
  { value: 'playing', label: 'Jogando', icon: 'play_arrow', colorVar: 'var(--status-playing)' },
  { value: 'completed', label: 'Zerado', icon: 'check_circle', colorVar: 'var(--status-completed)' },
  { value: 'dropped', label: 'Abandonado', icon: 'cancel', colorVar: 'var(--status-dropped)' },
];

@Component({
  selector: 'app-backlog-detail-page',
  standalone: true,
  imports: [
    DatePipe,
    FormsModule,
    RouterLink,
    FeedbackBannerComponent,
    GameCoverComponent,
    StatusBadgeComponent,
  ],
  template: `
    <div class="nq-page">
      <div>
        <a routerLink="/backlog" class="nq-btn nq-btn--ghost">
          <span class="ms-icon" aria-hidden="true">arrow_back</span>
          Voltar à Biblioteca
        </a>
      </div>

      <app-feedback-banner [message]="errorMessage()" tone="error" />
      <app-feedback-banner [message]="successMessage()" tone="success" />

      @if (loading()) {
        <div class="nq-card">Carregando detalhes do jogo...</div>
      } @else if (game(); as item) {
        <section class="detail-hero">
          <div class="detail-hero__banner">
            @if (item.coverUrl; as cover) {
              <img [src]="cover" alt="" aria-hidden="true" />
            }
            <div class="detail-hero__scrim"></div>
          </div>

          <div class="detail-hero__content">
            <div class="detail-hero__poster">
              <app-game-cover
                [src]="item.coverUrl"
                [title]="item.title"
                aspectRatio="3 / 4"
                scrim="none"
              />
            </div>

            <div class="detail-hero__info">
              <h1>{{ item.title }}</h1>
              <div class="detail-hero__badges">
                <app-status-badge [status]="status" />
                <span class="nq-chip">{{ item.platform }}</span>
                @if (item.rawgId) {
                  <span class="nq-chip nq-chip--accent">RAWG #{{ item.rawgId }}</span>
                }
                <span class="detail-date">Adicionado em {{ item.createdAt | date: 'dd/MM/yyyy' }}</span>
              </div>
            </div>
          </div>
        </section>

        <div class="detail-columns">
          <form class="nq-card edit-form" (ngSubmit)="save()">
            <h2>Editar jogo</h2>

            <div class="nq-field">
              <label for="edit-title">Título</label>
              <input id="edit-title" name="title" [(ngModel)]="title" required />
            </div>

            <div class="nq-field">
              <label for="edit-platform">Plataforma</label>
              <input id="edit-platform" name="platform" [(ngModel)]="platform" required />
            </div>

            <div class="nq-field">
              <label>Status do progresso</label>
              <div class="nq-status-selector" role="radiogroup" aria-label="Status do jogo">
                @for (choice of statusChoices; track choice.value) {
                  <button
                    type="button"
                    class="nq-status-option"
                    [class.is-selected]="status === choice.value"
                    [style.--status-color]="choice.colorVar"
                    (click)="status = choice.value"
                  >
                    <span class="ms-icon" aria-hidden="true">{{ choice.icon }}</span>
                    {{ choice.label }}
                  </button>
                }
              </div>
            </div>

            <div class="edit-actions">
              <button type="submit" class="nq-btn nq-btn--primary" [disabled]="saving()">
                <span class="ms-icon" aria-hidden="true">save</span>
                {{ saving() ? 'Salvando...' : 'Salvar alterações' }}
              </button>
            </div>
          </form>

          <aside class="nq-card danger-panel">
            <h2>Informações & Ações</h2>
            <dl class="meta-list">
              <div>
                <dt>Plataforma atual</dt>
                <dd>{{ item.platform }}</dd>
              </div>
              <div>
                <dt>Data de cadastro</dt>
                <dd>{{ item.createdAt | date: 'dd/MM/yyyy HH:mm' }}</dd>
              </div>
              @if (item.rawgId) {
                <div>
                  <dt>Origem</dt>
                  <dd>Catálogo RAWG (#{{ item.rawgId }})</dd>
                </div>
              }
            </dl>

            <div class="danger-zone">
              <p>Remover este jogo exclui apenas o registro do seu backlog pessoal.</p>
              @if (!confirmingDelete()) {
                <button
                  type="button"
                  class="nq-btn nq-btn--danger"
                  (click)="confirmingDelete.set(true)"
                >
                  <span class="ms-icon" aria-hidden="true">delete_outline</span>
                  Remover jogo
                </button>
              } @else {
                <div class="confirm-row">
                  <button
                    type="button"
                    class="nq-btn nq-btn--danger"
                    [disabled]="deleting()"
                    (click)="deleteGame()"
                  >
                    {{ deleting() ? 'Removendo...' : 'Confirmar exclusão' }}
                  </button>
                  <button
                    type="button"
                    class="nq-btn nq-btn--ghost"
                    (click)="confirmingDelete.set(false)"
                  >
                    Cancelar
                  </button>
                </div>
              }
            </div>
          </aside>
        </div>
      }
    </div>
  `,
  styles: `
    .detail-hero {
      border-radius: var(--radius-xl);
      overflow: hidden;
      background: var(--bg-surface);
      border: 1px solid var(--border-subtle);
      box-shadow: var(--shadow-card);
    }

    .detail-hero__banner {
      position: relative;
      height: 230px;
      overflow: hidden;
      background:
        radial-gradient(circle at 25% 20%, rgba(11, 105, 122, 0.4), transparent 55%),
        linear-gradient(135deg, var(--teal-dark), var(--bg-rail));

      img {
        width: 100%;
        height: 100%;
        object-fit: cover;
        filter: blur(22px) saturate(1.1);
        transform: scale(1.08);
        opacity: 0.52;
      }
    }

    .detail-hero__scrim {
      position: absolute;
      inset: 0;
      background: linear-gradient(to top, #101113 6%, rgba(16, 17, 19, 0.35) 75%);
    }

    .detail-hero__content {
      position: relative;
      padding: 0 28px 26px;
      margin-top: -108px;
      display: flex;
      flex-wrap: wrap;
      align-items: flex-end;
      gap: 24px;
    }

    .detail-hero__poster {
      width: 170px;
      border-radius: 14px;
      overflow: hidden;
      border: 1px solid var(--border-strong);
      box-shadow: 0 18px 42px rgba(0, 0, 0, 0.65);
      flex-shrink: 0;
    }

    .detail-hero__info {
      flex: 1;
      min-width: 240px;

      h1 {
        margin: 0 0 12px;
        font-size: 1.9rem;
        font-weight: 800;
        letter-spacing: -0.02em;
      }
    }

    .detail-hero__badges {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 10px;
    }

    .detail-date {
      color: var(--text-muted);
      font-size: 0.84rem;
    }

    .detail-columns {
      display: grid;
      grid-template-columns: 1.4fr 1fr;
      gap: 20px;
      align-items: start;
    }

    .edit-form,
    .danger-panel {
      display: flex;
      flex-direction: column;
      gap: 16px;

      h2 {
        margin: 0;
        font-size: 1.15rem;
      }
    }

    .meta-list {
      margin: 0;
      display: flex;
      flex-direction: column;
      gap: 12px;

      dt {
        font-size: 0.78rem;
        color: var(--text-muted);
      }

      dd {
        margin: 2px 0 0;
        font-weight: 600;
      }
    }

    .danger-zone {
      padding-top: 14px;
      border-top: 1px solid var(--border-subtle);
      display: flex;
      flex-direction: column;
      gap: 12px;

      p {
        margin: 0;
        color: var(--text-secondary);
        font-size: 0.86rem;
      }
    }

    .confirm-row {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
    }

    @media (max-width: 860px) {
      .detail-columns {
        grid-template-columns: 1fr;
      }

      .detail-hero__poster {
        width: 128px;
      }
    }
  `,
})
export class BacklogDetailPageComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly api = inject(BacklogApi);

  protected readonly statusChoices = STATUS_CHOICES;
  protected readonly game = signal<BacklogGame | null>(null);
  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly deleting = signal(false);
  protected readonly confirmingDelete = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly successMessage = signal<string | null>(null);

  protected title = '';
  protected platform = '';
  protected status: GameStatus = 'planned';

  private gameId = '';

  ngOnInit(): void {
    this.gameId = this.route.snapshot.paramMap.get('id') ?? '';
    this.api.find(this.gameId).subscribe({
      next: (item) => {
        this.game.set(item);
        this.title = item.title;
        this.platform = item.platform;
        this.status = item.status;
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        this.errorMessage.set(parseApiError(err).message);
      },
    });
  }

  protected save(): void {
    this.saving.set(true);
    this.errorMessage.set(null);
    this.successMessage.set(null);

    this.api
      .update(this.gameId, {
        title: this.title.trim(),
        platform: this.platform.trim(),
        status: this.status,
      })
      .subscribe({
        next: (updated) => {
          this.game.set(updated);
          this.saving.set(false);
          this.successMessage.set('Alterações salvas com sucesso.');
        },
        error: (err) => {
          this.saving.set(false);
          this.errorMessage.set(parseApiError(err).message);
        },
      });
  }

  protected deleteGame(): void {
    this.deleting.set(true);
    this.errorMessage.set(null);

    this.api.remove(this.gameId).subscribe({
      next: () => {
        this.deleting.set(false);
        void this.router.navigate(['/backlog']);
      },
      error: (err) => {
        this.deleting.set(false);
        this.errorMessage.set(parseApiError(err).message);
      },
    });
  }
}
