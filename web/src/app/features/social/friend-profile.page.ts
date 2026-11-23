import { NgTemplateOutlet } from '@angular/common';
import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Subscription, finalize } from 'rxjs';
import { parseApiError } from '../../core/errors/problem-details';
import { GameStatus } from '../../core/models/api.models';
import { FeedbackBannerComponent } from '../../shared/components/feedback-banner.component';
import { GameCoverComponent } from '../../shared/components/game-cover.component';
import { MetacriticBadgeComponent } from '../../shared/components/metacritic-badge.component';
import { PaginationComponent } from '../../shared/components/pagination.component';
import { StatusBadgeComponent } from '../../shared/components/status-badge.component';
import { FriendProfile, SocialApi } from './social.api';

@Component({
  standalone: true,
  imports: [
    NgTemplateOutlet,
    RouterLink,
    FeedbackBannerComponent,
    GameCoverComponent,
    MetacriticBadgeComponent,
    PaginationComponent,
    StatusBadgeComponent,
  ],
  template: `
    <main class="nq-page">
      <div class="friend-back">
        <a routerLink="/friends" class="nq-btn nq-btn--ghost">
          <span class="ms-icon" aria-hidden="true">arrow_back</span>
          Voltar aos amigos
        </a>
      </div>

      <app-feedback-banner [message]="error()" tone="error" [inline]="true" />

      @if (loading() && !profile()) {
        <div class="nq-card friend-loading" role="status">Carregando perfil…</div>
      }

      @if (profile(); as friend) {
        <header class="nq-hero-banner friend-banner">
          @if (friend.headerUrl; as banner) {
            <div class="nq-hero-banner__media"><img [src]="banner" alt="" /></div>
          }
          <div class="nq-hero-banner__content friend-banner__content">
            <div class="nq-hero-banner__top">
              <span class="nq-spotlight__eyebrow">
                <span class="ms-icon" aria-hidden="true">person</span>
                Perfil do amigo
              </span>
            </div>

            <div class="friend-heading">
              <div class="friend-avatar">
                @if (friend.avatarUrl; as avatar) {
                  <img [src]="avatar" alt="" />
                } @else {
                  <span>{{ initials(friend.displayName) }}</span>
                }
              </div>

              <div class="friend-heading__text">
                <h1>{{ friend.displayName }}</h1>
                @if (friend.bio) {
                  <p>{{ friend.bio }}</p>
                }
              </div>
            </div>
          </div>
        </header>

        <section class="nq-card friend-section">
          <div class="section-heading">
            <h2>
              <span class="ms-icon section-icon" aria-hidden="true">sports_esports</span>
              Jogando agora
            </h2>
            <span class="nq-chip">{{ friend.playing.length }}</span>
          </div>

          @if (friend.playing.length) {
            <ng-container
              [ngTemplateOutlet]="games"
              [ngTemplateOutletContext]="{ $implicit: friend.playing }"
            />
          } @else {
            <p class="friend-empty">Nenhum jogo marcado como jogando.</p>
          }
        </section>

        <section class="nq-card friend-section">
          <div class="section-heading">
            <h2>
              <span class="ms-icon section-icon" aria-hidden="true">library_books</span>
              Biblioteca
            </h2>
            @if (friend.library.items.length) {
              <span class="nq-chip">{{ friend.library.items.length }} nesta página</span>
            }
          </div>

          @if (friend.library.items.length) {
            <ng-container
              [ngTemplateOutlet]="games"
              [ngTemplateOutletContext]="{ $implicit: friend.library.items }"
            />
          } @else {
            <p class="friend-empty">Nenhum jogo nesta página.</p>
          }

          <app-pagination
            [page]="friend.library.page"
            [hasMore]="friend.library.hasMore"
            (pageChange)="load($event, friend.wishlist.page)"
          />
        </section>

        <section class="nq-card friend-section">
          <div class="section-heading">
            <h2>
              <span class="ms-icon section-icon" aria-hidden="true">favorite</span>
              Lista de desejos
            </h2>
            @if (friend.wishlist.items.length) {
              <span class="nq-chip">{{ friend.wishlist.items.length }} nesta página</span>
            }
          </div>

          @if (friend.wishlist.items.length) {
            <ul class="friend-games-grid">
              @for (game of friend.wishlist.items; track game.rawgId) {
                <li class="nq-mini-item friend-game-item">
                  <div class="friend-game-item__cover">
                    <app-game-cover [src]="game.coverUrl" [title]="game.title" aspectRatio="16 / 10" />
                  </div>
                  <div class="nq-mini-item__body">
                    <a class="friend-game-item__title" [routerLink]="['/catalog', game.rawgId]">
                      {{ game.title }}
                    </a>
                    <small>{{ game.platforms.length }} plataformas</small>
                  </div>
                  @if (game.metacriticScore != null) {
                    <app-metacritic-badge [score]="game.metacriticScore" />
                  }
                </li>
              }
            </ul>
          } @else {
            <p class="friend-empty">Nenhum jogo na lista de desejos.</p>
          }

          <app-pagination
            [page]="friend.wishlist.page"
            [hasMore]="friend.wishlist.hasMore"
            (pageChange)="load(friend.library.page, $event)"
          />
        </section>
      }
    </main>

    <ng-template #games let-items>
      <ul class="friend-games-grid">
        @for (game of items; track game.id) {
          <li class="nq-mini-item friend-game-item">
            <div class="friend-game-item__cover">
              <app-game-cover [src]="game.coverUrl" [title]="game.title" aspectRatio="16 / 10" />
            </div>
            <div class="nq-mini-item__body">
              @if (game.rawgId) {
                <a class="friend-game-item__title" [routerLink]="['/catalog', game.rawgId]">
                  {{ game.title }}
                </a>
              } @else {
                <strong class="friend-game-item__title">{{ game.title }}</strong>
              }
              <small>{{ game.platform }} · {{ statusLabel(game.status) }}</small>
            </div>
            <app-status-badge [status]="game.status" />
          </li>
        }
      </ul>
    </ng-template>
  `,
  styles: `
    .friend-back {
      display: flex;
      justify-content: flex-start;
    }

    .friend-loading {
      color: var(--text-secondary);
    }

    .friend-banner,
    .friend-banner__content {
      min-height: 240px;
    }

    .friend-heading {
      display: flex;
      flex-wrap: wrap;
      align-items: flex-end;
      gap: 18px;
    }

    .friend-avatar {
      width: 88px;
      height: 88px;
      border-radius: 20px;
      overflow: hidden;
      border: 3px solid var(--accent-primary);
      background: var(--bg-surface-elevated);
      display: grid;
      place-items: center;
      font-size: 1.5rem;
      font-weight: 800;
      color: var(--accent-primary);
      box-shadow: var(--shadow-glow);
      flex-shrink: 0;

      img {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }
    }

    .friend-heading__text {
      flex: 1;
      min-width: 220px;

      h1 {
        margin: 0 0 6px;
        font-size: 1.85rem;
        font-weight: 800;
        line-height: 1.15;
      }

      p {
        margin: 0;
        color: var(--text-secondary);
        max-width: 60ch;
      }
    }

    .friend-section {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .section-heading {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 12px;

      h2 {
        margin: 0;
        font-size: 1.12rem;
        display: inline-flex;
        align-items: center;
        gap: 8px;
      }
    }

    .section-icon {
      color: var(--accent-primary);
      font-size: 20px;
    }

    .friend-games-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(min(100%, 19rem), 1fr));
      gap: 12px;
      list-style: none;
      margin: 0;
      padding: 0;
    }

    .friend-game-item {
      padding: 10px 12px;
      border-color: var(--border-subtle);
    }

    .friend-game-item__cover {
      width: 64px;
      border-radius: var(--radius-sm);
      overflow: hidden;
      border: 1px solid var(--border-subtle);
      flex-shrink: 0;
    }

    .friend-game-item__title {
      display: block;
      font-size: 0.92rem;
      font-weight: 600;
      color: var(--text-primary);
      text-decoration: none;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    a.friend-game-item__title:hover {
      color: var(--accent-primary);
    }

    .friend-empty {
      margin: 0;
      color: var(--text-muted);
      font-size: 0.9rem;
    }
  `,
})
export class FriendProfilePage implements OnInit {
  private readonly api = inject(SocialApi);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  private id = '';
  private request?: Subscription;
  protected readonly profile = signal<FriendProfile | null>(null);
  protected readonly loading = signal(false);
  protected readonly error = signal('');
  private readonly labels: Record<GameStatus, string> = {
    planned: 'Planejado',
    playing: 'Jogando',
    completed: 'Zerado',
    dropped: 'Abandonado',
  };

  protected initials(name: string): string {
    return name.trim().slice(0, 2).toUpperCase() || 'NQ';
  }

  protected statusLabel(status: GameStatus): string {
    return this.labels[status];
  }

  ngOnInit(): void {
    this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      this.id = params.get('id') ?? '';
      this.profile.set(null);
      this.load(1, 1);
    });
  }

  protected load(page: number, wishlistPage: number): void {
    this.request?.unsubscribe();
    this.loading.set(true);
    this.error.set('');
    this.request = this.api
      .profile(this.id, page, wishlistPage)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.loading.set(false)),
      )
      .subscribe({
        next: (profile) => this.profile.set(profile),
        error: (error: unknown) => {
          this.profile.set(null);
          this.error.set(parseApiError(error).message);
        },
      });
  }
}
