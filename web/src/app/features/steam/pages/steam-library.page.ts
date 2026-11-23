import { Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthStore } from '../../../core/auth/auth.store';
import { parseApiError } from '../../../core/errors/problem-details';
import { SteamLibrary } from '../../../core/models/api.models';
import { FeedbackBannerComponent } from '../../../shared/components/feedback-banner.component';
import { GameCoverComponent } from '../../../shared/components/game-cover.component';
import { PaginationComponent } from '../../../shared/components/pagination.component';
import { SteamApi } from '../services/steam.api';

const SKELETON_ITEMS = [0, 1, 2, 3, 4, 5, 6, 7];

@Component({
  selector: 'app-steam-library-page',
  standalone: true,
  imports: [PaginationComponent, FormsModule, RouterLink, FeedbackBannerComponent, GameCoverComponent],
  template: `
    <div class="nq-page">
      <section class="nq-hero">
        <div>
          <span class="nq-spotlight__eyebrow">
            <span class="ms-icon" aria-hidden="true">sports_esports</span>
            Integração Steam
          </span>
          @if (embedded()) {
            <h2 class="steam-title">Biblioteca Steam</h2>
          } @else {
            <h1 class="steam-title">Biblioteca Steam</h1>
          }
          <p>Consulte seus jogos da Steam, horas jogadas e progresso de conquistas.</p>
        </div>

        @if (library()) {
          <div class="steam-controls">
            <div class="search-wrap">
              <span class="ms-icon" aria-hidden="true">search</span>
              <input
                type="search"
                name="steamFilter"
                [(ngModel)]="filterText"
                (ngModelChange)="filterSignal.set($event); page.set(1)"
                placeholder="Filtrar jogos Steam..."
                class="filter-input"
                aria-label="Filtrar jogos Steam"
              />
            </div>

            <div class="nq-view-toggle" role="group" aria-label="Modo de visualização">
              <button
                type="button"
                [class.is-active]="viewMode() === 'grid'"
                (click)="viewMode.set('grid')"
                aria-label="Grade de pôsteres"
              >
                <span class="ms-icon" aria-hidden="true">grid_view</span>
                Pôsteres
              </button>
              <button
                type="button"
                [class.is-active]="viewMode() === 'list'"
                (click)="viewMode.set('list')"
                aria-label="Lista compacta"
              >
                <span class="ms-icon" aria-hidden="true">view_list</span>
                Lista
              </button>
            </div>
          </div>
        }
      </section>

      @if (library(); as lib) {
        <section class="nq-stat-strip" aria-label="Estatísticas da biblioteca Steam">
          <div class="nq-stat-tile" style="--tile-color: var(--accent-cyan)">
            <span class="nq-stat-tile__icon">
              <span class="ms-icon" aria-hidden="true">sports_esports</span>
            </span>
            <div>
              <span class="nq-stat-tile__value">{{ lib.gameCount }}</span>
              <span class="nq-stat-tile__label">Jogos na conta</span>
            </div>
          </div>

          <div class="nq-stat-tile" style="--tile-color: var(--accent-primary)">
            <span class="nq-stat-tile__icon">
              <span class="ms-icon" aria-hidden="true">schedule</span>
            </span>
            <div>
              <span class="nq-stat-tile__value">{{ totalHours() }} h</span>
              <span class="nq-stat-tile__label">Horas acumuladas</span>
            </div>
          </div>

          <div class="nq-stat-tile" style="--tile-color: var(--status-completed)">
            <span class="nq-stat-tile__icon">
              <span class="ms-icon" aria-hidden="true">bolt</span>
            </span>
            <div>
              <span class="nq-stat-tile__value">{{ recentGamesCount() }}</span>
              <span class="nq-stat-tile__label">Ativos (2 semanas)</span>
            </div>
          </div>
        </section>
      }

      <app-feedback-banner [message]="errorMessage()" tone="error" />

      @if (loading()) {
        <div class="nq-skeleton-grid" aria-label="Carregando biblioteca Steam">
          @for (item of skeletonItems; track item) {
            <div class="nq-skeleton-card"></div>
          }
        </div>
      } @else if (needsLink()) {
        <div class="nq-empty">
          <h3>Conta Steam não vinculada</h3>
          <p>Vincule sua conta Steam para sincronizar jogos, tempo de jogo e conquistas.</p>
          <button
            type="button"
            class="nq-btn nq-btn--primary"
            [disabled]="linking()"
            (click)="linkSteam()"
          >
            <span class="ms-icon" aria-hidden="true">link</span>
            {{ linking() ? 'Redirecionando...' : 'Vincular conta Steam' }}
          </button>
        </div>
      } @else if (!errorMessage() && filteredGames().length === 0) {
        <div class="nq-empty">
          <h3>Nenhum jogo encontrado</h3>
          <p>Tente ajustar o filtro de busca.</p>
        </div>
      } @else if (!errorMessage()) {
        @if (viewMode() === 'grid') {
          <div class="nq-poster-grid">
            @for (game of pageItems(); track game.appId) {
              <a class="nq-poster-card" [routerLink]="['/steam', game.appId]">
                <app-game-cover
                  [src]="steamPosterUrl(game.appId)"
                  [fallbackSrc]="steamHeaderUrl(game.appId)"
                  [title]="game.name"
                  aspectRatio="3 / 4"
                  scrim="strong"
                  [zoomOnHover]="true"
                >
                  <div class="nq-poster-card__top">
                    <span class="nq-chip">
                      <span class="ms-icon chip-icon" aria-hidden="true">schedule</span>
                      {{ formatHours(game.playtimeForeverMinutes) }}
                    </span>
                    @if (game.playtimeTwoWeeksMinutes) {
                      <span class="nq-chip nq-chip--accent">2 sem</span>
                    }
                  </div>

                  <div class="nq-poster-card__overlay">
                    <h3 class="nq-poster-card__title">{{ game.name }}</h3>
                    <div class="nq-poster-card__footer">
                      <span>Ver conquistas</span>
                      <span class="ms-icon" aria-hidden="true">emoji_events</span>
                    </div>
                  </div>
                </app-game-cover>
              </a>
            }
          </div>
        } @else {
          <div class="nq-shelf-list">
            @for (game of pageItems(); track game.appId) {
              <a class="nq-shelf-row" [routerLink]="['/steam', game.appId]">
                <div class="nq-shelf-row__thumb">
                  <app-game-cover
                    [src]="steamPosterUrl(game.appId)"
                    [fallbackSrc]="steamHeaderUrl(game.appId)"
                    [title]="game.name"
                    aspectRatio="3 / 4"
                    scrim="none"
                  />
                </div>
                <div class="nq-shelf-row__main">
                  <strong>{{ game.name }}</strong>
                  <small>{{ formatHours(game.playtimeForeverMinutes) }} jogadas</small>
                </div>
                <span class="nq-chip nq-shelf-row__extra">
                  {{ formatHours(game.playtimeForeverMinutes) }}
                </span>
                @if (game.playtimeTwoWeeksMinutes) {
                  <span class="nq-chip nq-chip--accent">
                    {{ formatHours(game.playtimeTwoWeeksMinutes) }} (2 sem)
                  </span>
                } @else {
                  <span class="nq-chip">Conquistas</span>
                }
                <span class="ms-icon" aria-hidden="true">emoji_events</span>
              </a>
            }
          </div>
        }

        <app-pagination
          [page]="page()"
          [hasMore]="page() < totalPages()"
          [totalPages]="totalPages()"
          (pageChange)="page.set($event)"
        />
      }
    </div>
  `,
  styles: `
    .steam-title {
      margin-top: 10px;
    }

    .steam-controls {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 10px;
    }

    .search-wrap {
      position: relative;

      .ms-icon {
        position: absolute;
        left: 11px;
        top: 50%;
        transform: translateY(-50%);
        color: var(--text-muted);
        font-size: 18px;
        pointer-events: none;
      }
    }

    .filter-input {
      min-width: 220px;
      padding: 9px 13px 9px 36px;
      border-radius: var(--radius-md);
      border: 1px solid var(--border-subtle);
      background: var(--bg-input);
      color: var(--text-primary);
      font-family: inherit;
    }

    .chip-icon {
      font-size: 14px;
    }
  `,
})
export class SteamLibraryPageComponent implements OnInit {
  readonly embedded = input(false);
  private readonly api = inject(SteamApi);
  private readonly auth = inject(AuthStore);

  protected readonly skeletonItems = SKELETON_ITEMS;
  protected readonly library = signal<SteamLibrary | null>(null);
  protected readonly loading = signal(true);
  protected readonly needsLink = signal(false);
  protected readonly linking = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly filterSignal = signal('');
  protected readonly viewMode = signal<'grid' | 'list'>('grid');

  protected filterText = '';

  protected readonly totalHours = computed(() => {
    const minutes = (this.library()?.games ?? []).reduce(
      (sum, g) => sum + g.playtimeForeverMinutes,
      0,
    );
    return (minutes / 60).toFixed(0);
  });

  protected readonly recentGamesCount = computed(
    () =>
      (this.library()?.games ?? []).filter((g) => (g.playtimeTwoWeeksMinutes ?? 0) > 0).length,
  );

  protected readonly filteredGames = computed(() => {
    const games = this.library()?.games ?? [];
    const term = this.filterSignal().trim().toLowerCase();
    return term ? games.filter((g) => g.name.toLowerCase().includes(term)) : games;
  });

  protected readonly page = signal(1);
  private readonly pageSize = 20;
  protected readonly totalPages = computed(() =>
    Math.ceil(this.filteredGames().length / this.pageSize),
  );
  protected readonly pageItems = computed(() => {
    const start = (this.page() - 1) * this.pageSize;
    return this.filteredGames().slice(start, start + this.pageSize);
  });

  ngOnInit(): void {
    this.api.getLibrary().subscribe({
      next: (lib) => {
        this.library.set(lib);
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        const parsed = parseApiError(err);
        if (parsed.status === 409) {
          this.needsLink.set(true);
        } else {
          this.errorMessage.set(parsed.message);
        }
      },
    });
  }

  protected steamPosterUrl(appId: number): string {
    return `https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/${appId}/library_600x900.jpg`;
  }

  protected steamHeaderUrl(appId: number): string {
    return `https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/${appId}/header.jpg`;
  }

  protected formatHours(minutes: number): string {
    const hours = (minutes / 60).toFixed(1);
    return `${hours} h`;
  }

  protected async linkSteam(): Promise<void> {
    this.linking.set(true);
    this.errorMessage.set(null);
    try {
      const url = await this.auth.beginSteamFlow('link');
      window.location.assign(url);
    } catch (err) {
      this.linking.set(false);
      this.errorMessage.set(parseApiError(err).message);
    }
  }
}
