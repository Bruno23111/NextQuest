import { CurrencyPipe, registerLocaleData } from '@angular/common';
import localePt from '@angular/common/locales/pt';
import { HttpClient } from '@angular/common/http';
import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { API_BASE_URL } from '../../core/config/api.config';
import { parseApiError } from '../../core/errors/problem-details';
import { FeedbackBannerComponent } from '../../shared/components/feedback-banner.component';
import { GameCoverComponent } from '../../shared/components/game-cover.component';
import { PublishedVideo, youtubeWatchUrl } from '../videos/videos.api';

registerLocaleData(localePt, 'pt-BR');

interface WeekGame {
  id: string;
  title: string;
  platform: string;
  coverUrl: string | null;
  nextObjective: string | null;
}

interface WeekOverview {
  playing: WeekGame[];
  queue: WeekGame[];
  offers: {
    rawgId: number;
    offer: {
      title: string;
      shop: string;
      price: number;
      currency: string;
      discount: number;
      url: string;
    };
  }[];
  videos: PublishedVideo[];
}

const SKELETON_PANELS = [0, 1, 2, 3];

@Component({
  standalone: true,
  imports: [CurrencyPipe, RouterLink, FeedbackBannerComponent, GameCoverComponent],
  template: `
    <div class="nq-page">
      <header class="nq-hero">
        <div>
          <span class="nq-spotlight__eyebrow">
            <span class="ms-icon" aria-hidden="true">today</span>
            Resumo semanal
          </span>
          <h1 class="week-hero__title">Minha semana</h1>
          <p>Retome seus jogos, escolha o próximo da fila e descubra o que vale assistir ou comprar.</p>
        </div>

        <a routerLink="/backlog" class="nq-btn nq-btn--secondary">
          <span class="ms-icon" aria-hidden="true">grid_view</span>
          Abrir biblioteca
        </a>
      </header>

      <app-feedback-banner [message]="error()" tone="error" [inline]="true" />

      @if (loading()) {
        <div class="week-grid" role="status" aria-label="Carregando sua semana">
          @for (item of skeletonPanels; track item) {
            <div class="nq-skeleton-card week-skeleton"></div>
          }
        </div>
      } @else if (overview(); as current) {
        <section class="nq-stat-strip" aria-label="Resumo da semana">
          <div class="nq-stat-tile" style="--tile-color: var(--accent-cyan)">
            <span class="nq-stat-tile__icon">
              <span class="ms-icon" aria-hidden="true">sports_esports</span>
            </span>
            <div>
              <span class="nq-stat-tile__value">{{ current.playing.length }}</span>
              <span class="nq-stat-tile__label">Jogando agora</span>
            </div>
          </div>

          <div class="nq-stat-tile" style="--tile-color: var(--status-planned)">
            <span class="nq-stat-tile__icon">
              <span class="ms-icon" aria-hidden="true">format_list_numbered</span>
            </span>
            <div>
              <span class="nq-stat-tile__value">{{ current.queue.length }}</span>
              <span class="nq-stat-tile__label">Na fila</span>
            </div>
          </div>

          <div class="nq-stat-tile" style="--tile-color: var(--accent-primary)">
            <span class="nq-stat-tile__icon">
              <span class="ms-icon" aria-hidden="true">sell</span>
            </span>
            <div>
              <span class="nq-stat-tile__value">{{ current.offers.length }}</span>
              <span class="nq-stat-tile__label">Ofertas dos desejos</span>
            </div>
          </div>

          <div class="nq-stat-tile" style="--tile-color: var(--status-completed)">
            <span class="nq-stat-tile__icon">
              <span class="ms-icon" aria-hidden="true">play_circle</span>
            </span>
            <div>
              <span class="nq-stat-tile__value">{{ current.videos.length }}</span>
              <span class="nq-stat-tile__label">Vídeos sugeridos</span>
            </div>
          </div>
        </section>

        <div class="week-grid">
          <section class="nq-bento-card week-panel" aria-labelledby="week-playing">
            <div class="nq-bento-header">
              <h2 id="week-playing" class="panel-title">
                <span class="ms-icon panel-icon" aria-hidden="true">sports_esports</span>
                Jogando agora
              </h2>
              <a class="panel-link" routerLink="/backlog" [queryParams]="{ status: 'playing' }">
                Ver todos
                <span class="ms-icon" aria-hidden="true">arrow_forward</span>
              </a>
            </div>

            @if (current.playing.length) {
              <ul class="nq-mini-list week-list">
                @for (game of current.playing; track game.id) {
                  <li>
                    <a class="nq-mini-item week-item" [routerLink]="['/backlog', game.id]">
                      <div class="week-cover">
                        <app-game-cover [src]="game.coverUrl" [title]="game.title" aspectRatio="4 / 3" />
                      </div>
                      <div class="nq-mini-item__body">
                        <strong>{{ game.title }}</strong>
                        <small>{{ game.platform }}</small>
                        @if (game.nextObjective) {
                          <small class="week-objective">
                            <span class="ms-icon" aria-hidden="true">flag</span>
                            {{ game.nextObjective }}
                          </small>
                        }
                      </div>
                    </a>
                  </li>
                }
              </ul>
            } @else {
              <div class="week-empty">
                Marque um jogo como <strong>Jogando</strong> na biblioteca para retomá-lo aqui.
              </div>
            }
          </section>

          <section class="nq-bento-card week-panel" aria-labelledby="week-queue">
            <div class="nq-bento-header">
              <h2 id="week-queue" class="panel-title">
                <span class="ms-icon panel-icon" aria-hidden="true">format_list_numbered</span>
                Próximos da fila
              </h2>
              <a class="panel-link" routerLink="/backlog">
                Gerenciar fila
                <span class="ms-icon" aria-hidden="true">arrow_forward</span>
              </a>
            </div>

            @if (current.queue.length) {
              <ol class="nq-mini-list week-list">
                @for (game of current.queue; track game.id; let position = $index) {
                  <li>
                    <a class="nq-mini-item week-item" [routerLink]="['/backlog', game.id]">
                      <span class="queue-pos" aria-hidden="true">{{ position + 1 }}</span>
                      <div class="week-cover">
                        <app-game-cover [src]="game.coverUrl" [title]="game.title" aspectRatio="4 / 3" />
                      </div>
                      <div class="nq-mini-item__body">
                        <strong>{{ game.title }}</strong>
                        <small>{{ game.platform }}</small>
                      </div>
                    </a>
                  </li>
                }
              </ol>
            } @else {
              <div class="week-empty">
                Adicione jogos planejados à fila na sua biblioteca.
              </div>
            }
          </section>

          <section class="nq-bento-card week-panel" aria-labelledby="week-offers">
            <div class="nq-bento-header">
              <h2 id="week-offers" class="panel-title">
                <span class="ms-icon panel-icon" aria-hidden="true">sell</span>
                Ofertas dos seus desejos
              </h2>
              <a class="panel-link" routerLink="/wishlist">
                Ver desejos
                <span class="ms-icon" aria-hidden="true">arrow_forward</span>
              </a>
            </div>

            @if (current.offers.length) {
              <ul class="nq-mini-list week-list">
                @for (item of current.offers; track item.rawgId) {
                  <li class="nq-mini-item week-offer">
                    <div class="nq-mini-item__body">
                      <a class="week-item-link" [routerLink]="['/catalog', item.rawgId]">
                        {{ item.offer.title }}
                      </a>
                      <small>{{ item.offer.shop }}</small>
                    </div>
                    <a
                      [href]="item.offer.url"
                      target="_blank"
                      rel="noopener noreferrer"
                      class="nq-btn nq-btn--secondary week-offer__cta"
                      [attr.aria-label]="'Ver oferta de ' + item.offer.title + ' em ' + item.offer.shop"
                    >
                      <span>{{ item.offer.price | currency: item.offer.currency : 'symbol' : '1.2-2' : 'pt-BR' }}</span>
                      @if (item.offer.discount > 0) {
                        <span class="nq-chip nq-chip--accent">−{{ item.offer.discount }}%</span>
                      }
                    </a>
                  </li>
                }
              </ul>
            } @else {
              <div class="week-empty">
                Nenhum jogo da sua lista de desejos tem uma oferta publicada ativa.
              </div>
            }
          </section>

          <section class="nq-bento-card week-panel" aria-labelledby="week-videos">
            <div class="nq-bento-header">
              <h2 id="week-videos" class="panel-title">
                <span class="ms-icon panel-icon" aria-hidden="true">play_circle</span>
                Vídeos da sua biblioteca
              </h2>
              <a class="panel-link" routerLink="/videos">
                Ver todos
                <span class="ms-icon" aria-hidden="true">arrow_forward</span>
              </a>
            </div>

            @if (current.videos.length) {
              <ul class="nq-mini-list week-list">
                @for (video of current.videos; track video.id) {
                  <li>
                    <a
                      class="nq-mini-item week-item"
                      [href]="watchUrl(video.id)"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <div class="week-thumb">
                        @if (video.thumbnailUrl; as image) {
                          <img [src]="image" alt="" loading="lazy" />
                        } @else {
                          <span class="ms-icon" aria-hidden="true">play_circle</span>
                        }
                      </div>
                      <div class="nq-mini-item__body">
                        <strong>{{ video.title }}</strong>
                        <small>{{ video.gameTitle || video.channel }} · YouTube</small>
                      </div>
                      <span class="ms-icon week-ext-icon" aria-hidden="true">open_in_new</span>
                    </a>
                  </li>
                }
              </ul>
            } @else {
              <div class="week-empty">
                Ainda não há vídeos vinculados aos jogos da sua biblioteca.
              </div>
            }
          </section>
        </div>
      } @else if (error()) {
        <div class="nq-card">
          <button type="button" class="nq-btn nq-btn--secondary" (click)="load()">
            <span class="ms-icon" aria-hidden="true">refresh</span>
            Tentar novamente
          </button>
        </div>
      }
    </div>
  `,
  styles: `
    .week-hero__title {
      margin-top: 10px;
    }

    .week-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 18px;
      align-items: start;
    }

    .week-panel {
      min-width: 0;
    }

    .panel-title {
      display: inline-flex;
      align-items: center;
      gap: 8px;
    }

    .panel-icon {
      color: var(--accent-primary);
      font-size: 20px;
    }

    .panel-link {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      color: var(--accent-cyan);
      font-size: 0.84rem;
      font-weight: 600;
      text-decoration: none;

      .ms-icon {
        font-size: 16px;
      }

      &:hover {
        text-decoration: underline;
      }
    }

    .week-list {
      list-style: none;
      margin: 0;
      padding: 0;
    }

    .week-item {
      border-color: var(--border-subtle);
    }

    .week-cover {
      width: 56px;
      border-radius: var(--radius-sm);
      overflow: hidden;
      border: 1px solid var(--border-subtle);
      flex-shrink: 0;
    }

    .week-thumb {
      width: 88px;
      aspect-ratio: 16 / 9;
      border-radius: var(--radius-sm);
      overflow: hidden;
      border: 1px solid var(--border-subtle);
      background: var(--bg-surface-elevated);
      display: grid;
      place-items: center;
      color: var(--accent-primary);
      flex-shrink: 0;

      img {
        width: 100%;
        height: 100%;
        object-fit: cover;
        display: block;
      }
    }

    .week-objective {
      color: var(--accent-cyan) !important;
      margin-top: 4px !important;
    }

    .queue-pos {
      width: 26px;
      height: 26px;
      border-radius: 8px;
      display: grid;
      place-items: center;
      flex-shrink: 0;
      background: var(--accent-soft);
      border: 1px solid var(--border-glow);
      color: var(--accent-primary);
      font-size: 0.8rem;
      font-weight: 800;
      font-variant-numeric: tabular-nums;
    }

    .week-offer {
      justify-content: space-between;
      flex-wrap: wrap;
      border-color: var(--border-subtle);
    }

    .week-item-link {
      display: block;
      font-size: 0.9rem;
      font-weight: 600;
      color: var(--text-primary);
      text-decoration: none;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;

      &:hover {
        color: var(--accent-primary);
      }
    }

    .week-offer__cta {
      padding: 7px 12px;
      font-size: 0.82rem;
      flex-shrink: 0;
    }

    .week-ext-icon {
      font-size: 17px;
      color: var(--text-muted);
      flex-shrink: 0;
    }

    .week-empty {
      padding: 20px 14px;
      text-align: center;
      border-radius: var(--radius-md);
      border: 1px dashed var(--border-subtle);
      color: var(--text-muted);
      font-size: 0.88rem;
      line-height: 1.45;
    }

    .week-skeleton {
      aspect-ratio: 16 / 10;
    }

    @media (max-width: 820px) {
      .week-grid {
        grid-template-columns: 1fr;
      }
    }
  `,
})
export class WeekPage implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly api = inject(API_BASE_URL);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly skeletonPanels = SKELETON_PANELS;
  protected readonly watchUrl = youtubeWatchUrl;
  protected readonly loading = signal(false);
  protected readonly error = signal('');
  protected readonly overview = signal<WeekOverview | null>(null);

  ngOnInit(): void {
    this.load();
  }

  protected load(): void {
    if (this.loading()) return;
    this.loading.set(true);
    this.error.set('');
    this.http
      .get<WeekOverview>(this.api + '/week')
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.loading.set(false)),
      )
      .subscribe({
        next: (overview) => this.overview.set(overview),
        error: (error: unknown) => this.error.set(parseApiError(error).message),
      });
  }
}
