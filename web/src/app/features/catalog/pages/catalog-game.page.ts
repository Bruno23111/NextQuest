import { DatePipe } from '@angular/common';
import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Observable, finalize } from 'rxjs';
import { WishlistButtonComponent } from '../../social/wishlist-button.component';
import { parseApiError } from '../../../core/errors/problem-details';
import { CatalogGame, PagedResult } from '../../../core/models/api.models';
import { FeedbackBannerComponent } from '../../../shared/components/feedback-banner.component';
import { MetacriticBadgeComponent } from '../../../shared/components/metacritic-badge.component';
import { PaginationComponent } from '../../../shared/components/pagination.component';
import { SelectComponent, SelectOption } from '../../../shared/components/select.component';
import { CatalogApi } from '../services/catalog.api';
import { GameReview, ReviewsApi } from '../services/reviews.api';

const RATING_SCALE = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

@Component({
  selector: 'app-catalog-game-page',
  standalone: true,
  imports: [
    DatePipe,
    FormsModule,
    RouterLink,
    FeedbackBannerComponent,
    MetacriticBadgeComponent,
    PaginationComponent,
    SelectComponent,
    WishlistButtonComponent,
  ],
  template: `
    <div class="nq-page">
      <div>
        <a routerLink="/catalog" class="nq-btn nq-btn--ghost">
          <span class="ms-icon" aria-hidden="true">arrow_back</span>
          Voltar ao catálogo
        </a>
      </div>

      <app-feedback-banner [message]="error()" tone="error" />
      <app-feedback-banner [message]="notice() || null" tone="success" />

      @if (loadingGame()) {
        <div class="nq-card" role="status">Carregando jogo…</div>
      } @else if (game(); as current) {
        <section class="nq-hero-banner catalog-hero-banner">
          @if (current.coverUrl; as cover) {
            <div class="nq-hero-banner__media" aria-hidden="true">
              <img [src]="cover" alt="" />
            </div>
          }

          <div class="nq-hero-banner__content">
            <div class="nq-hero-banner__top">
              <span>Catálogo</span>
              @if (current.metacriticScore != null) {
                <app-metacritic-badge [score]="current.metacriticScore" />
              }
            </div>

            <div class="nq-hero-banner__bottom">
              <div class="nq-hero-banner__info">
                @if (current.platforms.length > 0) {
                  <div class="nq-hero-banner__pills">
                    @for (plat of current.platforms.slice(0, 4); track plat.id) {
                      <span class="nq-chip">{{ plat.name }}</span>
                    }
                  </div>
                }

                <h1>{{ current.title }}</h1>
                <app-wishlist-button [gameId]="current.rawgId" />

                @if (current.metacriticUrl; as url) {
                  <p>
                    <a [href]="url" target="_blank" rel="noopener noreferrer">
                      Ler críticas no Metacritic
                    </a>
                  </p>
                }
              </div>

              @if (current.platforms.length > 0) {
                <div class="hero-import">
                  <div class="hero-import__select">
                    <app-select
                      [options]="platformOptions()"
                      [value]="selectedPlatformId()"
                      ariaLabel="Plataforma para adicionar à biblioteca"
                      (valueChange)="selectedPlatform.set($event)"
                    />
                  </div>
                  @if (addedToBacklog()) {
                    <button type="button" class="nq-btn nq-btn--secondary" disabled>
                      <span class="ms-icon" aria-hidden="true">check</span>
                      Na biblioteca
                    </button>
                  } @else {
                    <button
                      type="button"
                      class="nq-btn nq-btn--primary"
                      [disabled]="importing()"
                      (click)="addToLibrary(current)"
                    >
                      <span class="ms-icon" aria-hidden="true">add</span>
                      {{ importing() ? 'Adicionando…' : 'Adicionar à biblioteca' }}
                    </button>
                  }
                </div>
              }
            </div>
          </div>
        </section>

        <div class="catalog-columns">
          <section class="nq-bento-card community">
            <div class="nq-bento-header">
              <h2>Críticas da comunidade</h2>
              @if (reviews(); as page) {
                <span class="nq-chip">{{ page.items.length }} nesta página</span>
              }
            </div>

            @if (loadingReviews()) {
              <p class="muted-note" role="status">Carregando críticas…</p>
            } @else if (reviews(); as page) {
              @if (page.items.length === 0) {
                <div class="nq-empty">
                  <h3>Nenhuma crítica ainda</h3>
                  <p>Seja a primeira pessoa a compartilhar sua opinião sobre este jogo.</p>
                </div>
              } @else {
                <div class="reviews-list">
                  @for (item of page.items; track $index) {
                    <article class="review-item">
                      <div class="review-item__head">
                        <span class="nq-avatar">
                          @if (item.authorAvatarUrl; as avatar) {
                            <img [src]="avatar" [alt]="item.authorName" />
                          } @else {
                            <span>{{ item.authorName.slice(0, 2).toUpperCase() }}</span>
                          }
                        </span>
                        <div class="review-item__meta">
                          <strong>{{ item.authorName }}</strong>
                          <small>{{ item.updatedAt | date: 'dd/MM/yyyy' }}</small>
                        </div>
                        <span class="nq-chip nq-chip--accent">{{ item.rating }}/10</span>
                      </div>
                      <p class="review-item__text">{{ item.text }}</p>
                    </article>
                  }
                </div>
              }
              <app-pagination [page]="page.page" [hasMore]="page.hasMore" (pageChange)="loadReviews($event)" />
            } @else {
              <div>
                <button type="button" class="nq-btn nq-btn--secondary" (click)="loadReviews(1, true)">
                  Tentar novamente
                </button>
              </div>
            }
          </section>

          @if (editorReady()) {
            <form class="nq-card review-editor" (ngSubmit)="save()">
              <h2>{{ mine() ? 'Editar minha crítica' : 'Escrever uma crítica' }}</h2>

              <div class="nq-field">
                <label>Nota (1 a 10)</label>
                <div class="rating-pills" role="radiogroup" aria-label="Nota de 1 a 10">
                  @for (score of ratingScale; track score) {
                    <button
                      type="button"
                      class="rating-pill"
                      [class.is-selected]="rating === score"
                      [disabled]="saving()"
                      (click)="rating = score"
                    >
                      {{ score }}
                    </button>
                  }
                </div>
              </div>

              <label class="nq-field">
                <span>Sua crítica</span>
                <textarea
                  name="review"
                  maxlength="2000"
                  required
                  rows="5"
                  placeholder="O que você achou da história, jogabilidade e trilha sonora?"
                  [(ngModel)]="review"
                  [disabled]="saving()"
                ></textarea>
              </label>

              <small class="muted-note">A crítica será visível para a comunidade NextQuest.</small>

              <div class="actions">
                <button type="submit" class="nq-btn nq-btn--primary" [disabled]="saving()">
                  <span class="ms-icon" aria-hidden="true">save</span>
                  {{ saving() ? 'Salvando…' : 'Salvar crítica' }}
                </button>
                @if (mine()) {
                  <button
                    type="button"
                    class="nq-btn nq-btn--danger"
                    [disabled]="saving()"
                    (click)="remove()"
                  >
                    <span class="ms-icon" aria-hidden="true">delete_outline</span>
                    Excluir crítica
                  </button>
                }
              </div>
            </form>
          }
        </div>
      }
    </div>
  `,
  styles: `
    .catalog-hero-banner {
      overflow: visible;

      .nq-hero-banner__media {
        border-radius: inherit;
        overflow: hidden;
      }
    }

    .hero-import {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 10px;
    }

    .hero-import__select {
      min-width: 190px;
    }

    .catalog-columns {
      display: grid;
      grid-template-columns: 1.25fr 1fr;
      gap: 22px;
      align-items: start;
    }

    .review-editor {
      display: flex;
      flex-direction: column;
      gap: 14px;

      h2 {
        margin: 0;
        font-size: 1.15rem;
      }
    }

    .rating-pills {
      display: grid;
      grid-template-columns: repeat(10, minmax(0, 1fr));
      gap: 6px;
    }

    .rating-pill {
      padding: 8px 0;
      border-radius: var(--radius-sm);
      border: 1px solid var(--border-subtle);
      background: var(--bg-input);
      color: var(--text-secondary);
      font-family: inherit;
      font-size: 0.86rem;
      font-weight: 700;
      cursor: pointer;
      transition: all 0.14s ease;

      &:hover:not(:disabled) {
        border-color: var(--border-strong);
        color: var(--text-primary);
      }

      &.is-selected {
        background: var(--accent-soft);
        color: var(--accent-primary);
        border-color: var(--border-glow);
      }
    }

    .reviews-list {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .review-item {
      padding: 14px;
      border-radius: var(--radius-md);
      background: var(--bg-surface);
      border: 1px solid var(--border-subtle);
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .review-item__head {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .review-item__meta {
      flex: 1;
      min-width: 0;

      strong {
        display: block;
        font-size: 0.92rem;
      }

      small {
        color: var(--text-muted);
        font-size: 0.78rem;
      }
    }

    .review-item__text {
      margin: 0;
      color: var(--text-secondary);
      font-size: 0.9rem;
      line-height: 1.5;
      white-space: pre-wrap;
      overflow-wrap: anywhere;
    }

    .actions {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
    }

    .muted-note {
      margin: 0;
      color: var(--text-muted);
      font-size: 0.84rem;
    }

    @media (max-width: 900px) {
      .catalog-columns {
        grid-template-columns: 1fr;
      }

      .rating-pills {
        grid-template-columns: repeat(5, minmax(0, 1fr));
      }
    }
  `,
})
export class CatalogGamePageComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly catalog = inject(CatalogApi);
  private readonly api = inject(ReviewsApi);
  private readonly destroyRef = inject(DestroyRef);
  private readonly id = Number(this.route.snapshot.paramMap.get('rawgId'));

  protected readonly ratingScale = RATING_SCALE;
  protected readonly game = signal<CatalogGame | null>(null);
  protected readonly reviews = signal<PagedResult<GameReview> | null>(null);
  protected readonly mine = signal<GameReview | null>(null);
  protected readonly editorReady = signal(false);
  protected readonly loadingGame = signal(true);
  protected readonly loadingReviews = signal(false);
  protected readonly saving = signal(false);
  protected readonly importing = signal(false);
  protected readonly addedToBacklog = signal(false);
  protected readonly selectedPlatform = signal<number | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly notice = signal('');
  protected rating: number | null = 8;
  protected review = '';

  protected readonly platformOptions = computed<SelectOption<number>[]>(() =>
    (this.game()?.platforms ?? []).map((p) => ({ value: p.id, label: p.name })),
  );

  protected readonly selectedPlatformId = computed(
    () => this.selectedPlatform() ?? this.game()?.platforms[0]?.id ?? null,
  );

  ngOnInit(): void {
    this.catalog
      .find(this.id)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.loadingGame.set(false)),
      )
      .subscribe({
        next: (game) => {
          this.game.set(game);
          this.loadReviews(1, true);
        },
        error: (error) => this.error.set(parseApiError(error).message),
      });
  }

  protected addToLibrary(current: CatalogGame): void {
    const platformId = this.selectedPlatformId();
    if (!platformId || this.importing()) return;

    this.importing.set(true);
    this.error.set(null);
    this.notice.set('');

    this.catalog
      .importGame({ rawgId: current.rawgId, platformId })
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.importing.set(false)),
      )
      .subscribe({
        next: (imported) => {
          this.addedToBacklog.set(true);
          this.notice.set(`"${imported.title}" foi adicionado à sua biblioteca!`);
        },
        error: (err) => {
          const parsed = parseApiError(err);
          if (parsed.status === 409) {
            this.addedToBacklog.set(true);
            this.error.set(`"${current.title}" já está na sua biblioteca.`);
          } else {
            this.error.set(parsed.message);
          }
        },
      });
  }

  protected loadReviews(page: number, resetEditor = false): void {
    if (this.loadingReviews()) return;
    this.loadingReviews.set(true);
    this.error.set(null);
    this.api
      .list(this.id, page)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.loadingReviews.set(false)),
      )
      .subscribe({
        next: (result) => {
          this.reviews.set(result.community);
          this.mine.set(result.mine);
          if (resetEditor) {
            this.rating = result.mine?.rating ?? 8;
            this.review = result.mine?.text ?? '';
          }
          this.editorReady.set(true);
        },
        error: (error) => this.error.set(parseApiError(error).message),
      });
  }

  protected save(): void {
    const rating = this.rating;
    const text = this.review.trim();
    if (this.saving() || this.loadingReviews()) return;
    if (
      rating === null ||
      !Number.isInteger(rating) ||
      rating < 1 ||
      rating > 10 ||
      !text ||
      text.length > 2000
    ) {
      this.error.set('Informe uma nota inteira de 1 a 10 e uma crítica de até 2000 caracteres.');
      return;
    }

    this.change(this.api.save(this.id, rating, text), 'Crítica salva.');
  }

  protected remove(): void {
    if (
      this.saving() ||
      this.loadingReviews() ||
      !window.confirm('Excluir sua crítica deste jogo?')
    ) {
      return;
    }
    this.change(this.api.remove(this.id), 'Crítica excluída.');
  }

  private change(request: Observable<void>, notice: string): void {
    this.saving.set(true);
    this.error.set(null);
    this.notice.set('');
    request
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.saving.set(false)),
      )
      .subscribe({
        next: () => {
          this.notice.set(notice);
          this.loadReviews(1, true);
        },
        error: (error) => this.error.set(parseApiError(error).message),
      });
  }
}
