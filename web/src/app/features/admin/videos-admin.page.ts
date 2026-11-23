import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Observable, finalize, of, switchMap } from 'rxjs';
import { parseApiError } from '../../core/errors/problem-details';
import { CatalogGame, PagedResult } from '../../core/models/api.models';
import { FeedbackBannerComponent } from '../../shared/components/feedback-banner.component';
import { PaginationComponent } from '../../shared/components/pagination.component';
import { SelectComponent, SelectOption } from '../../shared/components/select.component';
import { CatalogApi } from '../catalog/services/catalog.api';
import {
  PublishedVideo,
  VIDEO_CATEGORIES,
  VideoCategory,
  VideosApi,
  YouTubeVideo,
  youtubeWatchUrl,
} from '../videos/videos.api';

const CATEGORY_OPTIONS: readonly SelectOption<VideoCategory>[] = VIDEO_CATEGORIES.map((item) => ({
  value: item.value,
  label: item.label,
}));

@Component({
  standalone: true,
  imports: [
    FormsModule,
    RouterLink,
    FeedbackBannerComponent,
    PaginationComponent,
    SelectComponent,
  ],
  template: `
    <main class="nq-page">
      <header class="nq-hero">
        <div class="admin-hero__intro">
          <span class="nq-spotlight__eyebrow">
            <span class="ms-icon" aria-hidden="true">admin_panel_settings</span>
            Administração
          </span>
          <h1 class="admin-hero__title">Administração de vídeos</h1>
          <p>Escolha gameplays, análises e trailers para publicar na aba Vídeos.</p>

          <nav class="nq-tabs admin-nav" aria-label="Seções administrativas">
            <a routerLink="/admin" class="nq-tab">
              <span class="ms-icon" aria-hidden="true">sports_esports</span>
              Catálogo
            </a>
            <a routerLink="/admin/deals" class="nq-tab">
              <span class="ms-icon" aria-hidden="true">local_offer</span>
              Promoções
            </a>
            <a routerLink="/admin/videos" class="nq-tab is-active" aria-current="page">
              <span class="ms-icon" aria-hidden="true">smart_display</span>
              Vídeos
            </a>
          </nav>
        </div>

        <a routerLink="/videos" class="nq-btn nq-btn--secondary">
          <span class="ms-icon" aria-hidden="true">smart_display</span>
          Ver aba Vídeos
        </a>
      </header>

      <app-feedback-banner [message]="error()" tone="error" [inline]="true" />
      <app-feedback-banner [message]="notice()" tone="success" />

      @if (busy()) {
        <div class="video-admin-status" role="status">
          <span class="ms-icon" aria-hidden="true">hourglass_top</span>
          <span>Carregando…</span>
        </div>
      }

      <section class="nq-card video-admin-card">
        <div class="section-heading">
          <h2>
            <span class="ms-icon section-icon" aria-hidden="true">search</span>
            Buscar no YouTube
          </h2>
        </div>

        <form class="video-admin-inline" (ngSubmit)="search()">
          <div class="nq-field video-admin-inline__grow">
            <label for="yt-query">Título ou assunto</label>
            <input
              id="yt-query"
              type="search"
              name="query"
              [(ngModel)]="query"
              minlength="2"
              maxlength="120"
              placeholder="Ex: Elden Ring gameplay, Hollow Knight review..."
              required
            />
          </div>
          <button
            type="submit"
            class="nq-btn nq-btn--primary"
            [disabled]="busy() || query.trim().length < 2"
          >
            <span class="ms-icon" aria-hidden="true">search</span>
            Buscar vídeos
          </button>
        </form>
      </section>

      <section class="nq-card video-admin-card">
        <div class="section-heading">
          <h2>
            <span class="ms-icon section-icon" aria-hidden="true">publish</span>
            Publicar vídeo
          </h2>
        </div>

        <div class="video-admin-config">
          <div class="nq-field">
            <label>Categoria</label>
            <app-select
              [options]="categoryOptions"
              [value]="category"
              [disabled]="busy()"
              ariaLabel="Categoria do vídeo"
              (valueChange)="category = $event"
            />
          </div>

          <form class="video-admin-inline" (ngSubmit)="findGame()">
            <div class="nq-field video-admin-inline__grow">
              <label for="yt-game-query">Vincular jogo do catálogo (opcional)</label>
              <input
                id="yt-game-query"
                type="search"
                name="game"
                [(ngModel)]="gameQuery"
                maxlength="120"
                placeholder="Nome do jogo no catálogo..."
              />
            </div>
            <button
              type="submit"
              class="nq-btn nq-btn--secondary"
              [disabled]="busy() || !gameQuery.trim()"
            >
              <span class="ms-icon" aria-hidden="true">sports_esports</span>
              Buscar jogo
            </button>
          </form>
        </div>

        @if (gameMatches(); as matches) {
          @if (matches.length) {
            <div class="nq-field video-admin-game-select">
              <label>Jogo vinculado</label>
              <app-select
                [options]="gameSelectOptions()"
                [value]="game()?.rawgId ?? null"
                [disabled]="busy()"
                ariaLabel="Selecionar jogo vinculado"
                (valueChange)="selectGame($event)"
              />
            </div>
          } @else {
            <p class="video-admin-muted">Nenhum jogo do catálogo encontrado.</p>
          }
        }

        <form class="video-admin-inline" (ngSubmit)="publishLink()">
          <div class="nq-field video-admin-inline__grow">
            <label for="yt-link">Link ou ID do YouTube</label>
            <input
              id="yt-link"
              name="link"
              [(ngModel)]="link"
              maxlength="500"
              placeholder="https://www.youtube.com/watch?v=... ou ID de 11 caracteres"
            />
          </div>
          <button
            type="submit"
            class="nq-btn nq-btn--secondary"
            [disabled]="busy() || !link.trim()"
          >
            <span class="ms-icon" aria-hidden="true">add_link</span>
            Publicar pelo link
          </button>
        </form>

        @if (results(); as items) {
          <div class="video-admin-results">
            <div class="section-heading">
              <h3>Resultados do YouTube</h3>
              <span class="nq-chip">{{ items.length }}</span>
            </div>

            <ul class="video-admin-list">
              @for (item of items; track item.id) {
                <li class="video-admin-row">
                  @if (item.thumbnailUrl; as image) {
                    <img class="video-admin-row__thumb" [src]="image" alt="" loading="lazy" />
                  }
                  <div class="video-admin-row__info">
                    <a
                      class="video-admin-row__title"
                      [href]="watchUrl(item.id)"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {{ item.title }}
                    </a>
                    <small>{{ item.channel }} · YouTube</small>
                  </div>
                  @if (publishedIds().has(item.id)) {
                    <span class="nq-chip nq-chip--accent">Publicado</span>
                  } @else {
                    <button
                      type="button"
                      class="nq-btn nq-btn--primary video-admin-btn"
                      (click)="publish(item.id)"
                      [disabled]="busy()"
                    >
                      <span class="ms-icon" aria-hidden="true">publish</span>
                      Publicar
                    </button>
                  }
                </li>
              } @empty {
                <li class="video-admin-empty">Nenhum vídeo encontrado no YouTube.</li>
              }
            </ul>
          </div>
        }
      </section>

      <section class="nq-card video-admin-card">
        <div class="section-heading">
          <h2>
            <span class="ms-icon section-icon" aria-hidden="true">video_library</span>
            Vídeos publicados
          </h2>
          @if (published(); as current) {
            <span class="nq-chip">{{ current.items.length }} nesta página</span>
          }
        </div>

        @if (published(); as current) {
          <ul class="video-admin-list">
            @for (video of current.items; track video.id) {
              <li class="video-admin-row">
                @if (video.thumbnailUrl; as thumb) {
                  <img class="video-admin-row__thumb" [src]="thumb" alt="" loading="lazy" />
                }
                <div class="video-admin-row__info">
                  <a
                    class="video-admin-row__title"
                    [href]="watchUrl(video.id)"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {{ video.title }}
                  </a>
                  <small>
                    {{ video.channel }}
                    @if (video.gameTitle) {
                      · {{ video.gameTitle }}
                    }
                  </small>
                </div>
                <button
                  type="button"
                  class="nq-btn nq-btn--danger video-admin-btn"
                  (click)="remove(video)"
                  [disabled]="busy()"
                >
                  <span class="ms-icon" aria-hidden="true">delete_outline</span>
                  Retirar da aba Vídeos
                </button>
              </li>
            } @empty {
              <li class="video-admin-empty">Nenhum vídeo publicado.</li>
            }
          </ul>

          <app-pagination
            [page]="current.page"
            [hasMore]="current.hasMore"
            (pageChange)="load($event)"
          />
        }
      </section>
    </main>
  `,
  styles: `
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

    .video-admin-status {
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

      .ms-icon {
        font-size: 18px;
        color: var(--accent-cyan);
      }
    }

    .video-admin-card {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .section-heading {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 10px;

      h2,
      h3 {
        margin: 0;
        display: inline-flex;
        align-items: center;
        gap: 8px;
      }

      h2 {
        font-size: 1.12rem;
      }

      h3 {
        font-size: 1rem;
      }
    }

    .section-icon {
      color: var(--accent-primary);
      font-size: 20px;
    }

    .video-admin-config {
      display: grid;
      grid-template-columns: 200px 1fr;
      gap: 14px;
      align-items: end;
    }

    .video-admin-inline {
      display: flex;
      flex-wrap: wrap;
      align-items: end;
      gap: 10px;
    }

    .video-admin-inline__grow {
      flex: 1;
      min-width: 220px;
    }

    .video-admin-game-select {
      max-width: 380px;
    }

    .video-admin-results {
      display: flex;
      flex-direction: column;
      gap: 12px;
      padding-top: 12px;
      border-top: 1px solid var(--border-subtle);
    }

    .video-admin-list {
      display: flex;
      flex-direction: column;
      gap: 10px;
      margin: 0;
      padding: 0;
      list-style: none;
    }

    .video-admin-row {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 14px;
      padding: 10px 12px;
      border-radius: var(--radius-md);
      background: var(--bg-rail);
      border: 1px solid var(--border-subtle);
      transition: border-color 0.15s ease, background-color 0.15s ease;

      &:hover {
        border-color: var(--border-strong);
        background: var(--bg-surface-hover);
      }
    }

    .video-admin-row__thumb {
      width: 112px;
      aspect-ratio: 16 / 9;
      object-fit: cover;
      border-radius: var(--radius-sm);
      border: 1px solid var(--border-subtle);
      flex-shrink: 0;
    }

    .video-admin-row__info {
      flex: 1 1 14rem;
      min-width: 0;

      small {
        display: block;
        margin-top: 3px;
        color: var(--text-muted);
        font-size: 0.8rem;
      }
    }

    .video-admin-row__title {
      display: block;
      font-size: 0.94rem;
      font-weight: 600;
      color: var(--text-primary);
      text-decoration: none;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;

      &:hover {
        color: var(--accent-primary);
      }
    }

    .video-admin-btn {
      padding: 8px 14px;
      font-size: 0.84rem;
    }

    .video-admin-muted,
    .video-admin-empty {
      margin: 0;
      color: var(--text-muted);
      font-size: 0.9rem;
    }

    @media (max-width: 720px) {
      .video-admin-config {
        grid-template-columns: 1fr;
      }
    }
  `,
})
export class VideosAdminPage implements OnInit {
  private readonly api = inject(VideosApi);
  private readonly catalog = inject(CatalogApi);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly categoryOptions = CATEGORY_OPTIONS;
  protected readonly watchUrl = youtubeWatchUrl;
  protected query = '';
  protected gameQuery = '';
  protected link = '';
  protected category: VideoCategory = 'gameplay';
  protected readonly game = signal<CatalogGame | null>(null);
  protected readonly gameMatches = signal<CatalogGame[] | null>(null);
  protected readonly gameSelectOptions = computed<SelectOption<number | null>[]>(() => [
    { value: null, label: 'Sem jogo vinculado' },
    ...(this.gameMatches() ?? []).map((item) => ({ value: item.rawgId, label: item.title })),
  ]);
  protected readonly results = signal<YouTubeVideo[] | null>(null);
  protected readonly published = signal<PagedResult<PublishedVideo> | null>(null);
  protected readonly publishedIds = signal<ReadonlySet<string>>(new Set());
  protected readonly busy = signal(false);
  protected readonly error = signal('');
  protected readonly notice = signal('');

  ngOnInit(): void {
    this.load(1);
  }

  protected load(page: number): void {
    this.run(this.api.list(page), (result) => this.published.set(result));
  }

  protected search(): void {
    const q = this.query.trim();
    if (q.length < 2) return;
    this.run(this.api.search(q), ({ items, publishedIds }) => {
      this.results.set(items);
      this.publishedIds.set(new Set(publishedIds));
    });
  }

  protected findGame(): void {
    const q = this.gameQuery.trim();
    if (!q) return;
    this.run(this.catalog.search(q), (result) => {
      this.gameMatches.set(result.items);
      this.game.set(null);
    });
  }

  protected selectGame(id: number | null): void {
    this.game.set(this.gameMatches()?.find((item) => item.rawgId === id) ?? null);
  }

  protected publishLink(): void {
    const id = this.parseId(this.link.trim());
    if (!id) {
      this.error.set('Informe um link ou ID válido de vídeo do YouTube.');
      return;
    }
    this.publish(id);
  }

  protected publish(id: string): void {
    this.run(
      this.api.publish(id, this.category, this.game()?.rawgId ?? null).pipe(
        switchMap(() => {
          this.publishedIds.update((ids) => new Set(ids).add(id));
          this.link = '';
          this.notice.set('O vídeo está publicado.');
          return this.api.list(1);
        }),
      ),
      (result) => this.published.set(result),
    );
  }

  protected remove(video: PublishedVideo): void {
    const page = this.published()?.page ?? 1;
    this.run(
      this.api.remove(video.id).pipe(
        switchMap(() => {
          this.publishedIds.update((ids) => new Set([...ids].filter((id) => id !== video.id)));
          this.notice.set('Vídeo retirado da aba.');
          return this.api.list(page);
        }),
        switchMap((result) =>
          page > 1 && !result.items.length ? this.api.list(page - 1) : of(result),
        ),
      ),
      (result) => this.published.set(result),
    );
  }

  private run<T>(request: Observable<T>, done: (value: T) => void): void {
    if (this.busy()) return;
    this.busy.set(true);
    this.error.set('');
    this.notice.set('');
    request
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.busy.set(false)),
      )
      .subscribe({
        next: done,
        error: (error: unknown) => this.error.set(parseApiError(error).message),
      });
  }

  private parseId(value: string): string | null {
    const valid = (id: string | undefined | null): id is string =>
      !!id && /^[A-Za-z0-9_-]{11}$/.test(id);
    if (valid(value)) return value;
    try {
      const url = new URL(value);
      if (url.protocol !== 'https:' || url.username || url.password || url.port) return null;
      const [route, part] = url.pathname.split('/').slice(1);
      const id =
        url.hostname === 'youtu.be'
          ? route
          : ['youtube.com', 'www.youtube.com', 'm.youtube.com'].includes(url.hostname)
            ? route === 'watch'
              ? url.searchParams.get('v')
              : ['shorts', 'live', 'embed'].includes(route)
                ? part
                : null
            : null;
      return valid(id) ? id : null;
    } catch {
      return null;
    }
  }
}
