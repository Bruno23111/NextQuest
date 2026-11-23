import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { parseApiError } from '../../core/errors/problem-details';
import { PagedResult } from '../../core/models/api.models';
import { FeedbackBannerComponent } from '../../shared/components/feedback-banner.component';
import { PaginationComponent } from '../../shared/components/pagination.component';
import {
  PublishedVideo,
  VIDEO_CATEGORIES,
  VideoCategory,
  VideosApi,
  youtubeWatchUrl,
} from './videos.api';

const SKELETON_ITEMS = [0, 1, 2, 3, 4, 5, 6, 7];

@Component({
  standalone: true,
  imports: [FormsModule, RouterLink, FeedbackBannerComponent, PaginationComponent],
  template: `
    <main class="nq-page">
      <header class="nq-hero">
        <div>
          <span class="nq-spotlight__eyebrow">
            <span class="ms-icon" aria-hidden="true">smart_display</span>
            YouTube · Curadoria
          </span>
          <h1 class="videos-hero__title">Vídeos</h1>
          <p>Gameplays, análises e trailers selecionados no YouTube.</p>
        </div>

        <form class="videos-search" (ngSubmit)="search()">
          <label class="sr-only" for="videos-query">Buscar vídeo ou jogo</label>
          <div class="videos-search__input">
            <span class="ms-icon" aria-hidden="true">search</span>
            <input
              id="videos-query"
              name="q"
              type="search"
              maxlength="120"
              [(ngModel)]="query"
              placeholder="Buscar vídeo ou jogo..."
            />
          </div>
          <button type="submit" class="nq-btn nq-btn--primary" [disabled]="loading()">
            <span class="ms-icon" aria-hidden="true">search</span>
            Filtrar
          </button>
          @if (activeQuery || activeCategory) {
            <button
              type="button"
              class="nq-btn nq-btn--ghost"
              [disabled]="loading()"
              (click)="clearFilters()"
            >
              <span class="ms-icon" aria-hidden="true">close</span>
              Limpar
            </button>
          }
        </form>
      </header>

      <div class="nq-tabs" role="group" aria-label="Filtrar por categoria">
        <button
          type="button"
          class="nq-tab"
          [class.is-active]="category === ''"
          [attr.aria-pressed]="category === ''"
          [disabled]="loading()"
          (click)="selectCategory('')"
        >
          <span class="ms-icon" aria-hidden="true">apps</span>
          Todas
        </button>
        @for (item of categories; track item.value) {
          <button
            type="button"
            class="nq-tab"
            [class.is-active]="category === item.value"
            [attr.aria-pressed]="category === item.value"
            [disabled]="loading()"
            (click)="selectCategory(item.value)"
          >
            <span class="ms-icon" aria-hidden="true">{{ categoryIcon(item.value) }}</span>
            {{ item.label }}
          </button>
        }
      </div>

      <app-feedback-banner [message]="error()" tone="error" [inline]="true" />

      @if (player(); as current) {
        <section class="nq-card video-player" aria-label="Reprodutor do YouTube">
          <div class="video-player__header">
            <div class="video-player__title">
              <span class="nq-chip nq-chip--accent">{{ categoryLabel(current.video.category) }}</span>
              <h2>{{ current.video.title }}</h2>
            </div>

            <div class="video-player__actions">
              <a
                class="nq-btn nq-btn--secondary video-btn-sm"
                [href]="watchUrl(current.video.id)"
                target="_blank"
                rel="noopener noreferrer"
              >
                <span class="ms-icon" aria-hidden="true">open_in_new</span>
                Abrir no YouTube
              </a>
              <button
                type="button"
                class="nq-btn nq-btn--ghost video-btn-sm"
                (click)="player.set(null)"
              >
                <span class="ms-icon" aria-hidden="true">close</span>
                Fechar vídeo
              </button>
            </div>
          </div>

          <div class="video-player__frame">
            <iframe
              [src]="current.url"
              [title]="current.video.title"
              allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
              referrerpolicy="strict-origin-when-cross-origin"
              allowfullscreen
            ></iframe>
          </div>
        </section>
      }

      @if (loading()) {
        <div class="nq-skeleton-grid" role="status" aria-label="Carregando vídeos">
          @for (item of skeletonItems; track item) {
            <div class="nq-skeleton-card video-skeleton"></div>
          }
        </div>
      } @else if (result(); as current) {
        @if (current.items.length) {
          <div class="section-heading">
            <h2>
              @if (activeQuery) {
                Resultados para "{{ activeQuery }}"
              } @else if (activeCategory) {
                {{ categoryLabel(activeCategory) }}
              } @else {
                Vídeos publicados
              }
            </h2>
            <span class="nq-chip">{{ current.items.length }} nesta página</span>
          </div>

          <div class="nq-grid">
            @for (video of current.items; track video.id) {
              <article class="nq-game-card">
                <div class="video-thumb">
                  @if (video.thumbnailUrl; as thumbnail) {
                    <img [src]="thumbnail" [alt]="video.title" loading="lazy" />
                  } @else {
                    <div class="video-thumb__fallback">
                      <span class="ms-icon" aria-hidden="true">smart_display</span>
                    </div>
                  }
                  <div class="video-thumb__scrim"></div>
                  <div class="nq-poster-card__top">
                    <span class="nq-chip">{{ categoryLabel(video.category) }}</span>
                  </div>
                </div>

                <div class="nq-game-card__body">
                  <h2 class="nq-game-card__title">{{ video.title }}</h2>
                  <p class="video-card__channel">{{ video.channel }} · YouTube</p>

                  @if (video.rawgId && video.gameTitle) {
                    <a class="video-card__game" [routerLink]="['/catalog', video.rawgId]">
                      <span class="ms-icon" aria-hidden="true">sports_esports</span>
                      <span>{{ video.gameTitle }}</span>
                    </a>
                  }

                  <div class="video-card__actions">
                    @if (video.canPlayHere) {
                      <button
                        type="button"
                        class="nq-btn nq-btn--primary video-card__cta"
                        (click)="watch(video)"
                      >
                        <span class="ms-icon" aria-hidden="true">play_arrow</span>
                        Assistir
                      </button>
                    }
                    <a
                      [href]="watchUrl(video.id)"
                      class="nq-btn nq-btn--secondary video-card__cta"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <span class="ms-icon" aria-hidden="true">open_in_new</span>
                      YouTube
                    </a>
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
          <div class="nq-empty video-empty">
            <span class="ms-icon video-empty__icon" aria-hidden="true">smart_display</span>
            <h3>Nenhum vídeo encontrado</h3>
            <p>Nenhum vídeo publicado corresponde a esta busca.</p>
            @if (activeQuery || activeCategory) {
              <button type="button" class="nq-btn nq-btn--primary" (click)="clearFilters()">
                Limpar filtros
              </button>
            }
          </div>
        }
      }
    </main>
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

    .videos-hero__title {
      margin-top: 10px;
    }

    .videos-search {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 10px;
    }

    .videos-search__input {
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
        min-width: 230px;
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

    .video-player {
      display: flex;
      flex-direction: column;
      gap: 14px;
    }

    .video-player__header {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
    }

    .video-player__title {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 10px;
      min-width: 0;

      h2 {
        margin: 0;
        font-size: 1.12rem;
      }
    }

    .video-player__actions {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }

    .video-btn-sm {
      padding: 8px 14px;
      font-size: 0.84rem;
    }

    .video-player__frame {
      width: 100%;
      aspect-ratio: 16 / 9;
      border-radius: var(--radius-md);
      overflow: hidden;
      border: 1px solid var(--border-subtle);
      background: #000;

      iframe {
        display: block;
        width: 100%;
        height: 100%;
        border: 0;
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
        font-size: 1.15rem;
      }
    }

    .video-thumb {
      position: relative;
      width: 100%;
      aspect-ratio: 16 / 9;
      overflow: hidden;
      background: var(--bg-rail);

      img {
        display: block;
        width: 100%;
        height: 100%;
        object-fit: cover;
        transition: transform 0.28s ease;
      }
    }

    .nq-game-card:hover .video-thumb img {
      transform: scale(1.04);
    }

    .video-thumb__fallback {
      width: 100%;
      height: 100%;
      display: grid;
      place-items: center;
      color: var(--accent-primary);

      .ms-icon {
        font-size: 40px;
      }
    }

    .video-thumb__scrim {
      position: absolute;
      inset: 0;
      background: linear-gradient(to top, rgba(16, 17, 19, 0.7) 0%, transparent 50%);
      pointer-events: none;
    }

    .video-card__channel {
      margin: 0;
      font-size: 0.82rem;
      color: var(--text-muted);
    }

    .video-card__game {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      align-self: flex-start;
      color: var(--accent-cyan);
      font-size: 0.82rem;
      font-weight: 600;
      text-decoration: none;

      .ms-icon {
        font-size: 16px;
      }

      &:hover {
        text-decoration: underline;
      }
    }

    .video-card__actions {
      margin-top: auto;
      padding-top: 4px;
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }

    .video-card__cta {
      flex: 1;
      min-width: 0;
      padding: 9px 12px;
      font-size: 0.84rem;
    }

    .video-skeleton {
      aspect-ratio: 16 / 11;
    }

    .video-empty__icon {
      font-size: 40px;
      color: var(--accent-primary);
      margin-bottom: 10px;
    }

    @media (max-width: 540px) {
      .videos-search {
        width: 100%;
      }

      .videos-search__input {
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
export class VideosPage implements OnInit {
  private readonly api = inject(VideosApi);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly skeletonItems = SKELETON_ITEMS;
  protected readonly categories = VIDEO_CATEGORIES;
  protected readonly watchUrl = youtubeWatchUrl;
  protected query = '';
  protected category: VideoCategory | '' = '';
  protected activeQuery = '';
  protected activeCategory: VideoCategory | '' = '';
  protected readonly loading = signal(false);
  protected readonly error = signal('');
  protected readonly result = signal<PagedResult<PublishedVideo> | null>(null);
  protected readonly player = signal<{ video: PublishedVideo; url: SafeResourceUrl } | null>(null);

  ngOnInit(): void {
    this.load(1);
  }

  protected selectCategory(value: VideoCategory | ''): void {
    if (this.loading() || this.category === value) return;
    this.category = value;
    this.search();
  }

  protected clearFilters(): void {
    if (this.loading()) return;
    this.query = '';
    this.category = '';
    this.activeQuery = '';
    this.activeCategory = '';
    this.load(1);
  }

  protected search(): void {
    if (this.loading()) return;
    this.activeQuery = this.query.trim();
    this.activeCategory = this.category;
    this.load(1);
  }

  protected load(page: number): void {
    if (this.loading()) return;
    this.loading.set(true);
    this.error.set('');
    this.api
      .list(page, this.activeQuery, this.activeCategory)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.loading.set(false)),
      )
      .subscribe({
        next: (result) => this.result.set(result),
        error: (error: unknown) => this.error.set(parseApiError(error).message),
      });
  }

  protected watch(video: PublishedVideo): void {
    if (!video.canPlayHere || !/^[A-Za-z0-9_-]{11}$/.test(video.id)) return;
    const url = this.sanitizer.bypassSecurityTrustResourceUrl(
      'https://www.youtube-nocookie.com/embed/' + video.id + '?autoplay=1',
    );
    this.player.set({ video, url });
  }

  protected categoryLabel(category: VideoCategory): string {
    return this.categories.find((item) => item.value === category)?.label ?? 'Outros';
  }

  protected categoryIcon(category: VideoCategory): string {
    switch (category) {
      case 'gameplay':
        return 'sports_esports';
      case 'review':
        return 'rate_review';
      case 'trailer':
        return 'movie';
      default:
        return 'smart_display';
    }
  }
}
