import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { finalize, of, switchMap } from 'rxjs';
import { parseApiError } from '../../core/errors/problem-details';
import { CatalogGame, PagedResult } from '../../core/models/api.models';
import { FeedbackBannerComponent } from '../../shared/components/feedback-banner.component';
import { GameCoverComponent } from '../../shared/components/game-cover.component';
import { MetacriticBadgeComponent } from '../../shared/components/metacritic-badge.component';
import { PaginationComponent } from '../../shared/components/pagination.component';
import { SocialApi } from './social.api';
import { WishlistStore } from './wishlist.store';

const SKELETON_ITEMS = [0, 1, 2, 3, 4, 5, 6, 7];

@Component({
  standalone: true,
  imports: [
    RouterLink,
    FeedbackBannerComponent,
    GameCoverComponent,
    MetacriticBadgeComponent,
    PaginationComponent,
  ],
  template: `
    <main class="nq-page">
      <header class="nq-hero">
        <div>
          <span class="nq-spotlight__eyebrow">
            <span class="ms-icon" aria-hidden="true">favorite</span>
            Coleção futura
          </span>
          <h1 class="wishlist-hero__title">Lista de desejos</h1>
          <p>Os jogos do catálogo que você quer acompanhar.</p>
        </div>

        <a class="nq-btn nq-btn--secondary" routerLink="/catalog">
          <span class="ms-icon" aria-hidden="true">travel_explore</span>
          Explorar catálogo
        </a>
      </header>

      <app-feedback-banner [message]="error()" tone="error" [inline]="true" />

      @if (loading()) {
        <div class="nq-skeleton-grid" role="status" aria-label="Carregando lista de desejos">
          @for (item of skeletonItems; track item) {
            <div class="nq-skeleton-card wishlist-skeleton"></div>
          }
        </div>
      } @else if (result(); as current) {
        @if (current.items.length) {
          <div class="section-heading">
            <h2>Jogos salvos</h2>
            <span class="nq-chip">{{ current.items.length }} títulos nesta página</span>
          </div>

          <div class="nq-grid">
            @for (game of current.items; track game.rawgId) {
              <article class="nq-game-card">
                <a
                  class="wishlist-card__cover"
                  [routerLink]="['/catalog', game.rawgId]"
                  [attr.aria-label]="'Ver detalhes de ' + game.title"
                >
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
                </a>

                <div class="nq-game-card__body">
                  <h2 class="nq-game-card__title">
                    <a class="wishlist-card__title" [routerLink]="['/catalog', game.rawgId]">
                      {{ game.title }}
                    </a>
                  </h2>

                  <p class="wishlist-card__platforms">{{ platformSummary(game) }}</p>

                  <div class="wishlist-card__actions">
                    <a
                      class="nq-btn nq-btn--secondary wishlist-card__cta"
                      [routerLink]="['/catalog', game.rawgId]"
                    >
                      <span class="ms-icon" aria-hidden="true">open_in_new</span>
                      Ver jogo
                    </a>
                    <button
                      type="button"
                      class="nq-btn nq-btn--ghost wishlist-card__remove"
                      title="Remover dos desejos"
                      aria-label="Remover dos desejos"
                      [disabled]="loading() || store.loading() || store.pending().size > 0"
                      (click)="remove(game.rawgId)"
                    >
                      <span class="ms-icon" aria-hidden="true">heart_minus</span>
                    </button>
                  </div>
                </div>
              </article>
            }
          </div>

          <app-pagination
            [page]="current.page"
            [hasMore]="current.hasMore"
            (pageChange)="load($event)"
          />
        } @else {
          <div class="nq-empty wishlist-empty">
            <span class="ms-icon wishlist-empty__icon" aria-hidden="true">favorite_border</span>
            <h3>Sua lista de desejos está vazia</h3>
            <p>Explore o catálogo e salve os jogos que você pretende jogar.</p>
            <a class="nq-btn nq-btn--primary" routerLink="/catalog">
              <span class="ms-icon" aria-hidden="true">travel_explore</span>
              Explorar catálogo
            </a>
          </div>
        }
      }
    </main>
  `,
  styles: `
    .wishlist-hero__title {
      margin-top: 10px;
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

    .wishlist-card__cover {
      display: block;
      overflow: hidden;
    }

    .wishlist-card__title {
      color: var(--text-primary);
      text-decoration: none;

      &:hover {
        color: var(--accent-primary);
      }
    }

    .wishlist-card__platforms {
      margin: 0;
      font-size: 0.8rem;
      color: var(--text-muted);
      line-height: 1.4;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }

    .wishlist-card__actions {
      margin-top: auto;
      padding-top: 4px;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .wishlist-card__cta {
      flex: 1;
      min-width: 0;
      padding: 10px 12px;
      font-size: 0.85rem;
    }

    .wishlist-card__remove {
      padding: 10px;
      flex-shrink: 0;

      &:hover:not(:disabled) {
        color: var(--color-error);
        border-color: color-mix(in srgb, var(--color-error) 45%, transparent);
      }
    }

    .wishlist-skeleton {
      aspect-ratio: 16 / 11;
    }

    .wishlist-empty__icon {
      font-size: 40px;
      color: var(--accent-primary);
      margin-bottom: 10px;
    }
  `,
})
export class WishlistPage implements OnInit {
  private readonly api = inject(SocialApi);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly store = inject(WishlistStore);
  protected readonly skeletonItems = SKELETON_ITEMS;
  protected readonly result = signal<PagedResult<CatalogGame> | null>(null);
  protected readonly loading = signal(false);
  protected readonly error = signal('');

  ngOnInit(): void {
    this.load(1);
  }

  protected remove(id: number): void {
    this.store.set(id, false, () => {
      if (!this.destroyRef.destroyed) this.load(this.result()?.page ?? 1);
    });
  }

  protected load(page: number): void {
    if (this.loading()) return;
    this.loading.set(true);
    this.error.set('');
    this.api
      .wishlist(page)
      .pipe(
        switchMap((result) =>
          page > 1 && !result.items.length ? this.api.wishlist(page - 1) : of(result),
        ),
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.loading.set(false)),
      )
      .subscribe({
        next: (result) => this.result.set(result),
        error: (error: unknown) => this.error.set(parseApiError(error).message),
      });
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
