import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { parseApiError } from '../../../core/errors/problem-details';
import { CatalogGame } from '../../../core/models/api.models';
import { FeedbackBannerComponent } from '../../../shared/components/feedback-banner.component';
import { GameCoverComponent } from '../../../shared/components/game-cover.component';
import { PaginationComponent } from '../../../shared/components/pagination.component';
import { CatalogApi } from '../services/catalog.api';

const SKELETON_ITEMS = [0, 1, 2, 3, 4, 5, 6, 7];

@Component({
  selector: 'app-catalog-page',
  standalone: true,
  imports: [PaginationComponent, FormsModule, FeedbackBannerComponent, GameCoverComponent],
  template: `
    <div class="nq-page">
      <section class="nq-hero catalog-hero">
        <div>
          <span class="nq-spotlight__eyebrow">
            <span class="ms-icon" aria-hidden="true">travel_explore</span>
            Descoberta RAWG
          </span>
          <h1 class="catalog-hero__title">Catálogo RAWG</h1>
          <p>Pesquise títulos no catálogo global da RAWG e importe direto para o seu backlog.</p>
        </div>

        <form class="catalog-search" (ngSubmit)="submitSearch()">
          <div class="catalog-search__input">
            <span class="ms-icon" aria-hidden="true">search</span>
            <input
              type="search"
              name="query"
              [(ngModel)]="query"
              placeholder="Ex: Elden Ring, Hades..."
              aria-label="Pesquisar no catálogo RAWG"
            />
          </div>
          <button type="submit" class="nq-btn nq-btn--primary">
            <span class="ms-icon" aria-hidden="true">search</span>
            Pesquisar
          </button>
          <button
            type="button"
            class="nq-btn"
            [class.nq-btn--secondary]="!activeQuery()"
            [class.nq-btn--ghost]="!!activeQuery()"
            (click)="clearSearch()"
          >
            <span class="ms-icon" aria-hidden="true">local_fire_department</span>
            Populares
          </button>
        </form>
      </section>

      <div class="section-heading">
        <h2>
          @if (activeQuery()) {
            Resultados para "{{ activeQuery() }}"
          } @else {
            Populares na RAWG
          }
        </h2>
        @if (!loading() && games().length > 0) {
          <span class="nq-chip">{{ games().length }} títulos nesta página</span>
        }
      </div>

      <app-feedback-banner [message]="errorMessage()" tone="error" />
      <app-feedback-banner [message]="successMessage()" tone="success" />

      @if (loading()) {
        <div class="nq-skeleton-grid" aria-label="Carregando catálogo">
          @for (item of skeletonItems; track item) {
            <div class="nq-skeleton-card catalog-skeleton"></div>
          }
        </div>
      } @else if (games().length === 0) {
        <div class="nq-empty">
          <h3>Nenhum título encontrado</h3>
          <p>Tente outro termo de busca ou volte para os jogos populares.</p>
          @if (activeQuery()) {
            <button type="button" class="nq-btn nq-btn--primary" (click)="clearSearch()">
              Ver jogos populares
            </button>
          }
        </div>
      } @else {
        <div class="nq-grid">
          @for (game of games(); track game.rawgId) {
            <article class="nq-game-card">
              <app-game-cover
                [src]="game.coverUrl"
                [title]="game.title"
                aspectRatio="16 / 10"
                [zoomOnHover]="true"
              >
                <div class="card-top-badge">
                  <span class="nq-chip">
                    <span class="ms-icon chip-icon" aria-hidden="true">devices</span>
                    {{ game.platforms.length }}
                    {{ game.platforms.length === 1 ? 'plataforma' : 'plataformas' }}
                  </span>
                </div>
              </app-game-cover>

              <div class="nq-game-card__body">
                <h3 class="nq-game-card__title">{{ game.title }}</h3>

                @if (game.platforms.length > 0) {
                  <div class="nq-field">
                    <label [for]="'plat-' + game.rawgId">Plataforma</label>
                    <select
                      [id]="'plat-' + game.rawgId"
                      [ngModel]="selectedPlatform(game)"
                      (ngModelChange)="setPlatform(game.rawgId, $event)"
                    >
                      @for (plat of game.platforms; track plat.id) {
                        <option [ngValue]="plat.id">{{ plat.name }}</option>
                      }
                    </select>
                  </div>

                  @if (importedIds().has(game.rawgId)) {
                    <button type="button" class="nq-btn nq-btn--secondary imported-btn" disabled>
                      <span class="ms-icon" aria-hidden="true">check</span>
                      No Backlog
                    </button>
                  } @else {
                    <button
                      type="button"
                      class="nq-btn nq-btn--primary"
                      [disabled]="importingId() === game.rawgId"
                      (click)="importToBacklog(game)"
                    >
                      <span class="ms-icon" aria-hidden="true">add</span>
                      {{ importingId() === game.rawgId ? 'Importando...' : 'Importar para Backlog' }}
                    </button>
                  }
                } @else {
                  <span class="nq-chip">Sem plataforma disponível</span>
                }
              </div>
            </article>
          }
        </div>

        <app-pagination
          [page]="page()"
          [hasMore]="hasMore()"
          (pageChange)="goToPage($event)"
        />
      }
    </div>
  `,
  styles: `
    .catalog-hero__title {
      margin-top: 10px;
    }

    .catalog-search {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      align-items: center;
    }

    .catalog-search__input {
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
        border-radius: var(--radius-md);
        border: 1px solid var(--border-subtle);
        background: var(--bg-input);
        color: var(--text-primary);
        font-family: inherit;
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

    .card-top-badge {
      position: absolute;
      top: 10px;
      left: 10px;
      z-index: 2;
    }

    .chip-icon {
      font-size: 14px;
    }

    .imported-btn {
      color: var(--color-success);
      border-color: color-mix(in srgb, var(--color-success) 45%, transparent);
    }

    .catalog-skeleton {
      aspect-ratio: 16 / 11;
    }
  `,
})
export class CatalogPageComponent implements OnInit {
  private readonly api = inject(CatalogApi);
  private readonly route = inject(ActivatedRoute);

  protected readonly skeletonItems = SKELETON_ITEMS;
  protected readonly games = signal<CatalogGame[]>([]);
  protected readonly activeQuery = signal('');
  protected readonly page = signal(1);
  protected readonly hasMore = signal(false);
  protected readonly loading = signal(true);
  protected readonly importingId = signal<number | null>(null);
  protected readonly importedIds = signal<Set<number>>(new Set());
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly successMessage = signal<string | null>(null);

  protected query = '';
  private readonly platformSelections = new Map<number, number>();

  ngOnInit(): void {
    this.route.queryParamMap.subscribe((params) => {
      const q = params.get('q')?.trim() ?? '';
      this.query = q;
      this.activeQuery.set(q);
      this.page.set(1);
      this.load();
    });
  }

  protected submitSearch(): void {
    this.activeQuery.set(this.query.trim());
    this.page.set(1);
    this.load();
  }

  protected clearSearch(): void {
    this.query = '';
    this.activeQuery.set('');
    this.page.set(1);
    this.load();
  }

  protected goToPage(nextPage: number): void {
    this.page.set(nextPage);
    this.load();
  }

  protected selectedPlatform(game: CatalogGame): number {
    return this.platformSelections.get(game.rawgId) ?? game.platforms[0]?.id ?? 0;
  }

  protected setPlatform(rawgId: number, platformId: number): void {
    this.platformSelections.set(rawgId, Number(platformId));
  }

  protected importToBacklog(game: CatalogGame): void {
    const platformId = this.selectedPlatform(game);
    if (!platformId) return;

    this.importingId.set(game.rawgId);
    this.errorMessage.set(null);
    this.successMessage.set(null);

    this.api.importGame({ rawgId: game.rawgId, platformId }).subscribe({
      next: (imported) => {
        this.importingId.set(null);
        this.importedIds.update((set) => new Set([...set, game.rawgId]));
        this.successMessage.set(`"${imported.title}" foi adicionado ao seu backlog!`);
      },
      error: (err) => {
        this.importingId.set(null);
        const parsed = parseApiError(err);
        if (parsed.status === 409) {
          this.importedIds.update((set) => new Set([...set, game.rawgId]));
          this.errorMessage.set(`"${game.title}" já está no seu backlog.`);
        } else {
          this.errorMessage.set(parsed.message);
        }
      },
    });
  }

  private load(): void {
    this.loading.set(true);
    this.errorMessage.set(null);
    const q = this.activeQuery();
    const request$ = q ? this.api.search(q, this.page()) : this.api.popular(this.page());

    request$.subscribe({
      next: (res) => {
        this.games.set(res.items);
        this.hasMore.set(res.hasMore);
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        this.errorMessage.set(parseApiError(err).message);
      },
    });
  }
}
