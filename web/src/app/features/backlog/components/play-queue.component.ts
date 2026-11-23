import { DatePipe } from '@angular/common';
import { Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { parseApiError } from '../../../core/errors/problem-details';
import { BacklogGame } from '../../../core/models/api.models';
import { FeedbackBannerComponent } from '../../../shared/components/feedback-banner.component';
import { StatusBadgeComponent } from '../../../shared/components/status-badge.component';
import { PlayPlanApi, QueuedGame } from '../services/play-plan.api';

@Component({
  selector: 'app-play-queue',
  standalone: true,
  imports: [DatePipe, RouterLink, FeedbackBannerComponent, StatusBadgeComponent],
  template: `
    <section class="nq-bento-card">
      <div class="nq-bento-header">
        <h2>Próximos jogos</h2>
        <div class="queue-header__actions">
          @if (games(); as queue) {
            <span class="nq-chip">{{ queue.length }}/5</span>
            @if (candidate(); as game) {
              @if (!contains(game.id)) {
                <button
                  type="button"
                  class="nq-btn nq-btn--secondary queue-add-btn"
                  [disabled]="busy() || queue.length >= 5"
                  (click)="save([...queue, game])"
                >
                  <span class="ms-icon" aria-hidden="true">add</span>
                  Adicionar à fila
                </button>
              }
            }
          }
        </div>
      </div>

      <app-feedback-banner [message]="error()" tone="error" />

      @if (games(); as queue) {
        @if (queue.length === 0) {
          <p class="queue-muted">Abra um jogo do backlog para adicioná-lo à fila.</p>
        } @else {
          <div class="nq-mini-list">
            @for (game of queue; track game.id; let index = $index) {
              @let details = catalogById().get(game.id);
              <div class="nq-mini-item">
                <a class="queue-item__link" [routerLink]="['/backlog', game.id]">
                  <span class="nq-mini-item__thumb nq-mini-item__thumb--round">
                    @if (details?.coverUrl; as cover) {
                      <img [src]="cover" [alt]="game.title" />
                    } @else {
                      <span>#{{ index + 1 }}</span>
                    }
                  </span>

                  <span class="nq-mini-item__body">
                    <strong>{{ game.title }}</strong>
                    @if (details) {
                      <small>
                        #{{ index + 1 }} ·
                        <span class="ms-icon" aria-hidden="true">devices</span>
                        {{ details.platform }} ·
                        <span class="ms-icon" aria-hidden="true">calendar_today</span>
                        {{ details.createdAt | date: 'dd/MM' }}
                      </small>
                    } @else {
                      <small>Posição #{{ index + 1 }} na fila</small>
                    }
                  </span>
                </a>

                @if (details) {
                  <app-status-badge [status]="details.status" />
                }

                <div class="queue-actions">
                  <button
                    type="button"
                    class="nq-icon-circle nq-icon-circle--sm"
                    [disabled]="busy() || index === 0"
                    [attr.aria-label]="'Subir ' + game.title"
                    title="Subir na fila"
                    (click)="move(index, -1)"
                  >
                    <span class="ms-icon" aria-hidden="true">arrow_upward</span>
                  </button>
                  <button
                    type="button"
                    class="nq-icon-circle nq-icon-circle--sm"
                    [disabled]="busy() || index === queue.length - 1"
                    [attr.aria-label]="'Descer ' + game.title"
                    title="Descer na fila"
                    (click)="move(index, 1)"
                  >
                    <span class="ms-icon" aria-hidden="true">arrow_downward</span>
                  </button>
                  <button
                    type="button"
                    class="nq-icon-circle nq-icon-circle--sm queue-remove"
                    [disabled]="busy()"
                    [attr.aria-label]="'Remover ' + game.title"
                    title="Remover da fila"
                    (click)="remove(game.id)"
                  >
                    <span class="ms-icon" aria-hidden="true">close</span>
                  </button>
                </div>
              </div>
            }
          </div>
        }

        @if (queue.length === 5) {
          <p class="queue-muted">Fila completa · 5 jogos</p>
        }
      } @else if (busy()) {
        <p class="queue-muted">Carregando fila…</p>
      } @else {
        <div>
          <button type="button" class="nq-btn nq-btn--secondary" (click)="load()">
            Tentar novamente
          </button>
        </div>
      }
    </section>
  `,
  styles: `
    .queue-header__actions {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
    }

    .queue-add-btn {
      padding: 6px 12px;
      font-size: 0.82rem;
    }

    .queue-item__link {
      flex: 1;
      min-width: 0;
      display: flex;
      align-items: center;
      gap: 12px;
      text-decoration: none;
      color: inherit;
    }

    .queue-actions {
      display: flex;
      align-items: center;
      gap: 6px;
      flex-shrink: 0;

      button:disabled {
        opacity: 0.35;
        cursor: not-allowed;
      }
    }

    .queue-remove:hover:not(:disabled) {
      color: var(--color-error);
      border-color: color-mix(in srgb, var(--color-error) 55%, transparent);
    }

    .queue-muted {
      margin: 0;
      color: var(--text-muted);
      font-size: 0.86rem;
    }

    @media (max-width: 640px) {
      .nq-mini-item {
        flex-wrap: wrap;
      }
    }
  `,
})
export class PlayQueueComponent implements OnInit {
  readonly candidate = input<QueuedGame>();
  readonly catalog = input<readonly BacklogGame[]>([]);

  private readonly api = inject(PlayPlanApi);

  protected readonly games = signal<QueuedGame[] | null>(null);
  protected readonly busy = signal(true);
  protected readonly error = signal<string | null>(null);

  protected readonly catalogById = computed(
    () => new Map(this.catalog().map((item) => [item.id, item])),
  );

  ngOnInit(): void {
    this.load();
  }

  protected load(): void {
    this.busy.set(true);
    this.error.set(null);
    this.api.queue().subscribe({
      next: (games) => {
        this.games.set(games);
        this.busy.set(false);
      },
      error: (error) => this.fail(error),
    });
  }

  protected contains(id: string): boolean {
    return this.games()?.some((game) => game.id === id) ?? false;
  }

  protected remove(id: string): void {
    this.save((this.games() ?? []).filter((game) => game.id !== id));
  }

  protected move(index: number, offset: number): void {
    const games = [...(this.games() ?? [])];
    const target = index + offset;
    if (index < 0 || index >= games.length || target < 0 || target >= games.length) return;
    const [game] = games.splice(index, 1);
    games.splice(target, 0, game);
    this.save(games);
  }

  protected save(games: QueuedGame[]): void {
    if (this.busy()) return;
    this.busy.set(true);
    this.error.set(null);
    this.api.saveQueue(games).subscribe({
      next: () => {
        this.games.set(games);
        this.busy.set(false);
      },
      error: (error) => this.fail(error),
    });
  }

  private fail(error: unknown): void {
    this.error.set(parseApiError(error).message);
    this.busy.set(false);
  }
}
