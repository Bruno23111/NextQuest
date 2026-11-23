import { HttpClient } from '@angular/common/http';
import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { finalize, switchMap } from 'rxjs';
import { API_BASE_URL } from '../../core/config/api.config';
import { parseApiError } from '../../core/errors/problem-details';
import { BacklogGame, GameStatus, PagedResult } from '../../core/models/api.models';
import { FeedbackBannerComponent } from '../../shared/components/feedback-banner.component';
import { GameCoverComponent } from '../../shared/components/game-cover.component';
import { PaginationComponent } from '../../shared/components/pagination.component';
import { SelectComponent, SelectOption } from '../../shared/components/select.component';
import { StatusBadgeComponent } from '../../shared/components/status-badge.component';
import { BacklogApi } from '../backlog/services/backlog.api';
import { PsnSyncComponent } from './psn-sync.component';

type Tier = 'bronze' | 'silver' | 'gold' | 'platinum';
type TrophyCounts = Record<Tier, number>;
type PlayStationGame = Pick<
  BacklogGame,
  'id' | 'title' | 'platform' | 'status' | 'rawgId' | 'coverUrl'
> & {
  trophies: TrophyCounts | null;
};

const SYSTEMS = [
  'PlayStation 5',
  'PlayStation 4',
  'PlayStation 3',
  'PlayStation 2',
  'PlayStation',
  'PSP',
  'PS Vita',
] as const;

const SYSTEM_OPTIONS: readonly SelectOption<string>[] = SYSTEMS.map((system) => ({
  value: system,
  label: system,
}));

const SKELETON_ITEMS = [0, 1, 2, 3, 4, 5, 6, 7];

@Component({
  standalone: true,
  imports: [
    FormsModule,
    RouterLink,
    FeedbackBannerComponent,
    GameCoverComponent,
    PaginationComponent,
    SelectComponent,
    StatusBadgeComponent,
    PsnSyncComponent,
  ],
  template: `
    <main class="nq-page">
      <header class="nq-hero">
        <div>
          <span class="nq-spotlight__eyebrow">
            <span class="ms-icon" aria-hidden="true">sports_esports</span>
            PlayStation Network
          </span>
          <h1 class="psn-hero__title">PlayStation</h1>
          <p>Seus jogos da biblioteca NextQuest e os troféus que você registrou.</p>
        </div>

        <a routerLink="/catalog" class="nq-btn nq-btn--secondary">
          <span class="ms-icon" aria-hidden="true">travel_explore</span>
          Buscar no catálogo
        </a>
      </header>

      <app-feedback-banner tone="error" [message]="error()" [inline]="true" />
      <app-feedback-banner tone="success" [message]="notice()" />

      <app-psn-sync (imported)="clearSearch()" />

      <section class="nq-card psn-add-card">
        <div class="section-heading">
          <h2>
            <span class="ms-icon section-icon" aria-hidden="true">add_circle</span>
            Adicionar jogo
          </h2>
        </div>

        <form class="psn-add-form" (ngSubmit)="create()">
          <div class="nq-field psn-add-form__title">
            <label for="psn-title">Título</label>
            <input
              id="psn-title"
              name="title"
              [(ngModel)]="title"
              maxlength="250"
              placeholder="Ex: God of War Ragnarök, Astro Bot..."
              required
            />
          </div>

          <div class="nq-field psn-add-form__platform">
            <label>Plataforma</label>
            <app-select
              [options]="systemOptions"
              [value]="platform"
              [disabled]="busy()"
              ariaLabel="Plataforma PlayStation"
              (valueChange)="platform = $event"
            />
          </div>

          <button
            type="submit"
            class="nq-btn nq-btn--primary psn-add-form__submit"
            [disabled]="busy() || !title.trim()"
          >
            <span class="ms-icon" aria-hidden="true">add</span>
            Adicionar à biblioteca
          </button>
        </form>
      </section>

      <section class="psn-library">
        <div class="psn-library__header">
          <div class="section-heading">
            <h2>
              <span class="ms-icon section-icon" aria-hidden="true">trophy</span>
              Meus jogos
            </h2>
            @if (result(); as current) {
              @if (current.items.length > 0) {
                <span class="nq-chip">{{ current.items.length }} nesta página</span>
              }
            }
          </div>

          <form class="psn-search" (ngSubmit)="search()">
            <label class="sr-only" for="psn-search">Buscar na biblioteca</label>
            <div class="psn-search__input">
              <span class="ms-icon" aria-hidden="true">search</span>
              <input
                id="psn-search"
                name="query"
                [(ngModel)]="query"
                maxlength="120"
                type="search"
                placeholder="Buscar na biblioteca..."
              />
            </div>
            <button type="submit" class="nq-btn nq-btn--secondary" [disabled]="busy()">
              <span class="ms-icon" aria-hidden="true">search</span>
              Buscar
            </button>
            @if (activeQuery) {
              <button type="button" class="nq-btn nq-btn--ghost" [disabled]="busy()" (click)="clearSearch()">
                <span class="ms-icon" aria-hidden="true">close</span>
                Limpar
              </button>
            }
          </form>
        </div>

        @if (busy() && !result()) {
          <div class="nq-skeleton-grid" role="status" aria-label="Carregando jogos PlayStation">
            @for (item of skeletonItems; track item) {
              <div class="nq-skeleton-card psn-skeleton"></div>
            }
          </div>
        } @else if (result(); as current) {
          @if (current.items.length) {
            <div class="nq-grid">
              @for (game of current.items; track game.id) {
                <article class="nq-game-card">
                  <a
                    class="psn-card__cover"
                    [routerLink]="['/backlog', game.id]"
                    [attr.aria-label]="'Abrir ' + game.title"
                  >
                    <app-game-cover
                      [src]="game.coverUrl ?? null"
                      [title]="game.title"
                      aspectRatio="16 / 10"
                      [zoomOnHover]="true"
                    >
                      <div class="nq-poster-card__top">
                        <span class="nq-chip">{{ game.platform }}</span>
                        <app-status-badge [status]="game.status" />
                      </div>
                    </app-game-cover>
                  </a>

                  <div class="nq-game-card__body">
                    <h3 class="nq-game-card__title">
                      <a class="psn-card__title" [routerLink]="['/backlog', game.id]">{{ game.title }}</a>
                    </h3>

                    @if (editing() === game.id) {
                      <form class="trophies-form" (ngSubmit)="save(game)">
                        <div class="trophies-form__grid">
                          @for (tier of tiers; track tier.key) {
                            <div class="nq-field trophy-field" [style.--tier-color]="tier.color">
                              <label [for]="'trophy-' + game.id + '-' + tier.key">
                                <span class="trophy-dot" aria-hidden="true"></span>
                                {{ tier.label }}
                              </label>
                              <input
                                [id]="'trophy-' + game.id + '-' + tier.key"
                                type="number"
                                min="0"
                                max="9999"
                                step="1"
                                required
                                [name]="tier.key"
                                [(ngModel)]="draft[tier.key]"
                              />
                            </div>
                          }
                        </div>

                        <div class="trophies-form__actions">
                          <button type="submit" class="nq-btn nq-btn--primary psn-cta" [disabled]="busy()">
                            <span class="ms-icon" aria-hidden="true">save</span>
                            Salvar troféus
                          </button>
                          <button
                            type="button"
                            class="nq-btn nq-btn--ghost psn-cta-ghost"
                            [disabled]="busy()"
                            (click)="editing.set(null)"
                          >
                            Cancelar
                          </button>
                        </div>
                      </form>
                    } @else {
                      @if (game.trophies; as counts) {
                        <ul class="trophy-grid" aria-label="Troféus registrados">
                          @for (tier of tiers; track tier.key) {
                            <li class="trophy-pill" [style.--tier-color]="tier.color">
                              <span class="ms-icon trophy-pill__icon" aria-hidden="true">emoji_events</span>
                              <span class="trophy-pill__val">{{ counts[tier.key] }}</span>
                              <span class="trophy-pill__label">{{ tier.label }}</span>
                            </li>
                          }
                        </ul>
                      } @else {
                        <p class="psn-no-trophies">Sem troféus registrados.</p>
                      }

                      <div class="psn-card__actions">
                        <button
                          type="button"
                          class="nq-btn nq-btn--secondary psn-cta"
                          [disabled]="busy()"
                          (click)="edit(game)"
                        >
                          <span class="ms-icon" aria-hidden="true">emoji_events</span>
                          {{ game.trophies ? 'Editar troféus' : 'Registrar troféus' }}
                        </button>
                      </div>
                    }
                  </div>
                </article>
              }
            </div>
          } @else {
            <div class="nq-empty psn-empty">
              <span class="ms-icon psn-empty__icon" aria-hidden="true">sports_esports</span>
              <h3>{{ activeQuery ? 'Nenhum jogo encontrado' : 'Biblioteca PlayStation vazia' }}</h3>
              <p>
                {{
                  activeQuery
                    ? 'Tente outro termo de busca ou limpe o filtro.'
                    : 'Adicione seus jogos de PlayStation acima ou busque no catálogo.'
                }}
              </p>
              @if (activeQuery) {
                <button type="button" class="nq-btn nq-btn--primary" (click)="clearSearch()">
                  Limpar busca
                </button>
              } @else {
                <a class="nq-btn nq-btn--primary" routerLink="/catalog">Explorar catálogo</a>
              }
            </div>
          }

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

    .psn-hero__title {
      margin-top: 10px;
    }

    .section-heading {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 10px;

      h2 {
        margin: 0;
        font-size: 1.15rem;
        display: inline-flex;
        align-items: center;
        gap: 8px;
      }
    }

    .section-icon {
      color: var(--accent-primary);
      font-size: 20px;
    }

    .psn-add-card {
      display: flex;
      flex-direction: column;
      gap: 14px;
    }

    .psn-add-form {
      display: grid;
      grid-template-columns: 1fr 220px auto;
      gap: 12px;
      align-items: end;
    }

    .psn-library {
      display: flex;
      flex-direction: column;
      gap: 18px;
    }

    .psn-library__header {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
    }

    .psn-search {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 10px;
    }

    .psn-search__input {
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
        min-width: 220px;
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

    .psn-card__cover {
      display: block;
      overflow: hidden;
    }

    .psn-card__title {
      color: var(--text-primary);
      text-decoration: none;

      &:hover {
        color: var(--accent-primary);
      }
    }

    .trophy-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 8px;
      margin: 0;
      padding: 0;
      list-style: none;
    }

    .trophy-pill {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 6px 9px;
      border-radius: var(--radius-sm);
      background: var(--bg-rail);
      border: 1px solid color-mix(in srgb, var(--tier-color) 32%, var(--border-subtle));
      font-size: 0.78rem;
    }

    .trophy-pill__icon {
      font-size: 16px;
      color: var(--tier-color);
      flex-shrink: 0;
    }

    .trophy-pill__val {
      font-weight: 700;
      color: var(--text-primary);
      font-variant-numeric: tabular-nums;
    }

    .trophy-pill__label {
      color: var(--text-muted);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .psn-no-trophies {
      margin: 0;
      font-size: 0.84rem;
      color: var(--text-muted);
    }

    .trophies-form {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .trophies-form__grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 8px;
    }

    .trophy-field label {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-size: 0.78rem;
    }

    .trophy-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: var(--tier-color);
      flex-shrink: 0;
    }

    .trophy-field input {
      padding: 7px 10px;
      font-size: 0.88rem;
    }

    .trophies-form__actions,
    .psn-card__actions {
      margin-top: auto;
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }

    .psn-cta {
      flex: 1;
      padding: 9px 12px;
      font-size: 0.85rem;
    }

    .psn-cta-ghost {
      padding: 9px 12px;
      font-size: 0.85rem;
    }

    .psn-skeleton {
      aspect-ratio: 16 / 11;
    }

    .psn-empty__icon {
      font-size: 40px;
      color: var(--accent-primary);
      margin-bottom: 10px;
    }

    @media (max-width: 820px) {
      .psn-add-form {
        grid-template-columns: 1fr;
      }
    }
  `,
})
export class PlayStationPage implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly url = inject(API_BASE_URL) + '/playstation/games';
  private readonly backlog = inject(BacklogApi);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly skeletonItems = SKELETON_ITEMS;
  protected readonly systemOptions = SYSTEM_OPTIONS;
  protected readonly tiers: { key: Tier; label: string; color: string }[] = [
    { key: 'bronze', label: 'Bronze', color: '#cd7f32' },
    { key: 'silver', label: 'Prata', color: '#cbd5e1' },
    { key: 'gold', label: 'Ouro', color: '#fbbf24' },
    { key: 'platinum', label: 'Platina', color: '#8bdaeb' },
  ];

  protected title = '';
  protected platform: string = SYSTEMS[0];
  protected query = '';
  protected activeQuery = '';
  protected draft: TrophyCounts = { bronze: 0, silver: 0, gold: 0, platinum: 0 };
  protected readonly editing = signal<string | null>(null);
  protected readonly result = signal<PagedResult<PlayStationGame> | null>(null);
  protected readonly busy = signal(false);
  protected readonly error = signal('');
  protected readonly notice = signal('');

  ngOnInit(): void {
    this.load(1);
  }

  protected search(): void {
    if (this.busy()) return;
    this.activeQuery = this.query.trim();
    this.load(1);
  }

  protected clearSearch(): void {
    if (this.busy()) return;
    this.query = '';
    this.activeQuery = '';
    this.load(1);
  }

  protected load(page: number): void {
    if (this.busy()) return;
    this.editing.set(null);
    this.begin();
    this.read(page)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.busy.set(false)),
      )
      .subscribe({
        next: (result) => this.result.set(result),
        error: (error: unknown) => this.error.set(parseApiError(error).message),
      });
  }

  protected create(): void {
    if (this.busy() || !this.title.trim()) return;
    this.begin();
    this.backlog
      .create({ title: this.title.trim(), platform: this.platform })
      .pipe(
        switchMap(() => {
          this.title = '';
          this.query = this.activeQuery = '';
          this.editing.set(null);
          this.notice.set('Jogo adicionado à biblioteca.');
          return this.read(1);
        }),
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.busy.set(false)),
      )
      .subscribe({
        next: (result) => this.result.set(result),
        error: (error: unknown) => this.error.set(parseApiError(error).message),
      });
  }

  protected edit(game: PlayStationGame): void {
    this.draft = game.trophies ? { ...game.trophies } : { bronze: 0, silver: 0, gold: 0, platinum: 0 };
    this.editing.set(game.id);
  }

  protected save(game: PlayStationGame): void {
    if (this.busy()) return;
    const counts = { ...this.draft };
    if (Object.values(counts).some((value) => !Number.isInteger(value) || value < 0 || value > 9999)) {
      this.error.set('Informe quantidades inteiras entre 0 e 9999.');
      return;
    }
    this.begin();
    this.http
      .put<void>(`${this.url}/${game.id}/trophies`, counts)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.busy.set(false)),
      )
      .subscribe({
        next: () => {
          this.result.update(
            (result) =>
              result && {
                ...result,
                items: result.items.map((item) =>
                  item.id === game.id ? { ...item, trophies: counts } : item,
                ),
              },
          );
          this.editing.set(null);
          this.notice.set('Troféus salvos.');
        },
        error: (error: unknown) => this.error.set(parseApiError(error).message),
      });
  }

  private read(page: number) {
    return this.http.get<PagedResult<PlayStationGame>>(this.url, {
      params: { page, q: this.activeQuery },
    });
  }

  private begin(): void {
    this.busy.set(true);
    this.error.set('');
    this.notice.set('');
  }
}
