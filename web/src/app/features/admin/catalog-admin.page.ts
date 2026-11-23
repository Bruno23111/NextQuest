import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { parseApiError } from '../../core/errors/problem-details';
import { CatalogGame, PagedResult } from '../../core/models/api.models';
import { FeedbackBannerComponent } from '../../shared/components/feedback-banner.component';
import { GameCoverComponent } from '../../shared/components/game-cover.component';
import { MetacriticBadgeComponent } from '../../shared/components/metacritic-badge.component';
import { PaginationComponent } from '../../shared/components/pagination.component';
import { CatalogAdminApi } from './catalog-admin.api';
import { PopularBatchComponent } from './popular-batch.component';

const SKELETON_ITEMS = [0, 1, 2, 3, 4, 5, 6, 7];

@Component({
  standalone: true,
  imports: [
    FormsModule,
    RouterLink,
    FeedbackBannerComponent,
    GameCoverComponent,
    MetacriticBadgeComponent,
    PaginationComponent,
    PopularBatchComponent,
  ],
  template: `
    <div class="nq-page">
      <section class="nq-hero">
        <div class="admin-hero__intro">
          <span class="nq-spotlight__eyebrow">
            <span class="ms-icon" aria-hidden="true">admin_panel_settings</span>
            Administração
          </span>
          <h1 class="admin-hero__title">Administração do catálogo</h1>
          <p>Busque jogos na RAWG e escolha quais publicar no catálogo.</p>

          <nav class="nq-tabs admin-nav" aria-label="Seções administrativas">
            <a routerLink="/admin" class="nq-tab is-active" aria-current="page">
              <span class="ms-icon" aria-hidden="true">sports_esports</span>
              Catálogo
            </a>
            <a routerLink="/admin/deals" class="nq-tab">
              <span class="ms-icon" aria-hidden="true">local_offer</span>
              Promoções
            </a>
          </nav>
        </div>

        <form class="admin-search" (ngSubmit)="search(query.trim(), 1)">
          <label class="sr-only" for="admin-search">Título do jogo</label>
          <div class="admin-search__input">
            <span class="ms-icon" aria-hidden="true">search</span>
            <input
              id="admin-search"
              type="search"
              name="query"
              [(ngModel)]="query"
              placeholder="Ex: Elden Ring, Hollow Knight..."
              required
            />
          </div>
          <button
            type="submit"
            class="nq-btn nq-btn--primary"
            [disabled]="busy() || !query.trim()"
          >
            <span class="ms-icon" aria-hidden="true">search</span>
            {{ searching() ? 'Buscando...' : 'Buscar' }}
          </button>
          @if (query || result()) {
            <button
              type="button"
              class="nq-btn nq-btn--ghost"
              [disabled]="busy()"
              (click)="clearSearch()"
            >
              <span class="ms-icon" aria-hidden="true">close</span>
              Limpar
            </button>
          }
        </form>
      </section>

      <app-popular-batch source="catalog" (catalogPublished)="markPublished($event)" />

      <app-feedback-banner [message]="error()" tone="error" [inline]="true" />
      <app-feedback-banner [message]="notice()" tone="success" />

      @if (searching()) {
        <div class="nq-skeleton-grid" role="status" aria-label="Buscando jogos na RAWG">
          @for (item of skeletonItems; track item) {
            <div class="nq-skeleton-card admin-skeleton"></div>
          }
        </div>
      } @else if (result(); as games) {
        <div class="section-heading">
          <h2>Resultados para "{{ lastQuery }}"</h2>
          @if (games.items.length > 0) {
            <span class="nq-chip">{{ games.items.length }} títulos nesta página</span>
          }
        </div>

        @if (games.items.length === 0) {
          <div class="nq-empty">
            <h3>Nenhum jogo encontrado</h3>
            <p>Nenhum título encontrado para “{{ lastQuery }}”. Tente outro termo de busca.</p>
            <button type="button" class="nq-btn nq-btn--secondary" (click)="clearSearch()">
              Limpar busca
            </button>
          </div>
        } @else {
          <div class="nq-grid">
            @for (game of games.items; track game.rawgId) {
              <article class="nq-game-card">
                <app-game-cover
                  [src]="game.coverUrl"
                  [title]="game.title"
                  aspectRatio="16 / 10"
                  [zoomOnHover]="true"
                >
                  <div class="nq-poster-card__top">
                    <span class="nq-chip">
                      <span class="ms-icon chip-icon" aria-hidden="true">devices</span>
                      {{ game.platforms.length }}
                    </span>
                    @if (game.metacriticScore != null) {
                      <app-metacritic-badge [score]="game.metacriticScore" />
                    }
                  </div>
                </app-game-cover>

                <div class="nq-game-card__body">
                  <h3 class="nq-game-card__title">{{ game.title }}</h3>

                  <p class="admin-card__platforms">{{ platformSummary(game) }}</p>

                  <div class="admin-card__actions">
                    @if (added().has(game.rawgId)) {
                      <span class="published-label">
                        <span class="ms-icon" aria-hidden="true">check</span>
                        Já no catálogo
                      </span>
                    } @else {
                      <button
                        type="button"
                        class="nq-btn nq-btn--primary admin-card__cta"
                        [disabled]="busy()"
                        (click)="add(game)"
                      >
                        <span class="ms-icon" aria-hidden="true">add</span>
                        {{ addingId() === game.rawgId ? 'Adicionando...' : 'Adicionar ao catálogo' }}
                      </button>
                    }
                  </div>
                </div>
              </article>
            }
          </div>

          <app-pagination
            [page]="games.page"
            [hasMore]="games.hasMore"
            (pageChange)="search(lastQuery, $event)"
          />
        }
      } @else {
        <div class="nq-empty admin-empty">
          <span class="ms-icon admin-empty__icon" aria-hidden="true">travel_explore</span>
          <h3>Pronto para buscar na RAWG</h3>
          <p>Digite o título de um jogo acima para consultar a base da RAWG e publicar no catálogo.</p>
        </div>
      }
    </div>
  `,
  styles: `
    .sr-only {
      position: absolute;
      width: 1px;
      height: 1px;
      padding: 0;
      margin: -1px;
      overflow: hidden;
      clip: rect(0, 0, 0, 0);
      white-space: nowrap;
      border: 0;
    }

    .admin-hero__intro {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
    }

    .admin-hero__title {
      margin-top: 10px;
    }

    .admin-nav {
      margin-top: 14px;

      a {
        text-decoration: none;
      }
    }

    .admin-search {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      align-items: center;
    }

    .admin-search__input {
      position: relative;

      .ms-icon {
        position: absolute;
        left: 12px;
        top: 50%;
        transform: translateY(-50%);
        color: var(--text-muted);
        font-size: 18px;
        pointer-events: none;
      }

      input {
        min-width: 240px;
        padding: 10px 14px 10px 38px;
        border-radius: 999px;
        border: 1px solid var(--border-subtle);
        background: var(--bg-input);
        color: var(--text-primary);
        font-family: inherit;
        font-size: 0.92rem;
        outline: none;
        transition: border-color 0.15s ease, box-shadow 0.15s ease;

        &:focus {
          border-color: var(--accent-cyan);
          box-shadow: 0 0 0 3px rgba(139, 218, 235, 0.16);
        }
      }
    }

    .section-heading {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 12px;

      h2 {
        margin: 0;
        font-size: 1.2rem;
      }
    }

    .chip-icon {
      font-size: 14px;
    }

    .admin-card__platforms {
      margin: 0;
      font-size: 0.8rem;
      color: var(--text-muted);
      line-height: 1.4;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }

    .admin-card__actions {
      margin-top: auto;
      padding-top: 4px;
      display: flex;
    }

    .admin-card__cta {
      width: 100%;
      padding: 10px 12px;
      font-size: 0.85rem;
    }

    .published-label {
      display: inline-flex;
      align-items: center;
      gap: 0.4rem;
      color: var(--color-success);
    }

    .admin-skeleton {
      aspect-ratio: 16 / 11;
    }

    .admin-empty__icon {
      font-size: 40px;
      color: var(--accent-primary);
      margin-bottom: 10px;
    }

    .admin-empty p {
      margin-bottom: 0;
    }

    @media (max-width: 540px) {
      .admin-search {
        width: 100%;
      }

      .admin-search__input {
        flex: 1;
        min-width: 0;

        input {
          width: 100%;
          min-width: 0;
          box-sizing: border-box;
        }
      }
    }
  `,
})
export class CatalogAdminPage {
  private readonly api = inject(CatalogAdminApi);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly skeletonItems = SKELETON_ITEMS;
  protected query = '';
  protected lastQuery = '';
  protected readonly searching = signal(false);
  protected readonly addingId = signal<number | null>(null);
  protected readonly busy = computed(() => this.searching() || this.addingId() !== null);
  protected readonly notice = signal('');
  protected readonly error = signal('');
  protected readonly result = signal<PagedResult<CatalogGame> | null>(null);
  protected readonly added = signal(new Set<number>());

  protected search(query: string, page: number): void {
    if (!query) {
      return;
    }

    this.searching.set(true);
    this.error.set('');
    this.notice.set('');
    this.api
      .search(query, page)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.searching.set(false)),
      )
      .subscribe({
        next: (result) => {
          this.lastQuery = query;
          this.markPublished(result.publishedIds);
          this.result.set(result);
        },
        error: (err: unknown) => this.error.set(parseApiError(err).message),
      });
  }

  protected clearSearch(): void {
    this.query = '';
    this.lastQuery = '';
    this.error.set('');
    this.notice.set('');
    this.result.set(null);
  }

  protected add(game: CatalogGame): void {
    if (this.added().has(game.rawgId)) return;

    this.addingId.set(game.rawgId);
    this.error.set('');
    this.notice.set('');
    this.api
      .add(game.rawgId)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.addingId.set(null)),
      )
      .subscribe({
        next: (saved) => {
          this.markPublished([saved.rawgId]);
          this.notice.set(`${saved.title} foi adicionado ao catálogo.`);
        },
        error: (err: unknown) => this.error.set(parseApiError(err).message),
      });
  }

  protected markPublished(publishedIds: number[]): void {
    this.added.update((ids) => new Set([...ids, ...publishedIds]));
  }

  protected platformSummary(game: CatalogGame): string {
    if (game.platforms.length === 0) {
      return 'Sem plataformas listadas';
    }
    const names = game.platforms.slice(0, 3).map((p) => p.name);
    const extra = game.platforms.length - names.length;
    return extra > 0 ? `${names.join(' · ')} +${extra}` : names.join(' · ');
  }
}
