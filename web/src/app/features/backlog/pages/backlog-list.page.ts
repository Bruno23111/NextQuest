import { catchError, of, startWith, switchMap } from 'rxjs';
import { PlayPlanApi } from '../services/play-plan.api';
import { PlayQueueComponent } from '../components/play-queue.component';
import { DatePipe } from '@angular/common';
import {
  Component,
  DestroyRef,
  HostListener,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed, toSignal, toObservable } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { parseApiError } from '../../../core/errors/problem-details';
import {
  BacklogGame,
  GameStatus,
  SteamGameAchievements,
} from '../../../core/models/api.models';
import { FeedbackBannerComponent } from '../../../shared/components/feedback-banner.component';
import { GameCoverComponent } from '../../../shared/components/game-cover.component';
import { PaginationComponent } from '../../../shared/components/pagination.component';
import { StatusBadgeComponent } from '../../../shared/components/status-badge.component';
import { SteamApi } from '../../steam/services/steam.api';
import { BacklogApi } from '../services/backlog.api';
import { buildActivityHeatmap } from '../utils/activity-heatmap';

interface StatusTab {
  label: string;
  value: GameStatus | null;
  icon: string;
}

const STATUS_TABS: StatusTab[] = [
  { label: 'Todos', value: null, icon: 'apps' },
  { label: 'Jogando', value: 'playing', icon: 'play_arrow' },
  { label: 'Planejado', value: 'planned', icon: 'bookmark_border' },
  { label: 'Zerado', value: 'completed', icon: 'check_circle' },
  { label: 'Abandonado', value: 'dropped', icon: 'cancel' },
];

const SKELETON_ITEMS = [0, 1, 2, 3, 4, 5, 6, 7];

@Component({
  selector: 'app-backlog-list-page',
  standalone: true,
  imports: [
    PlayQueueComponent,
    DatePipe,
    FormsModule,
    RouterLink,
    FeedbackBannerComponent,
    GameCoverComponent,
    PaginationComponent,
    StatusBadgeComponent,
  ],
  template: `
    <div class="nq-page">
      @if (featuredGame(); as spotlight) {
        <section class="nq-hero-banner">
          <div class="nq-hero-banner__media" aria-hidden="true">
            <img src="jogando-coelho.webp" alt="" />
          </div>

          <div class="nq-hero-banner__content">
            <div class="nq-hero-banner__top">
              Adicionado em {{ spotlight.createdAt | date: 'dd MMM' }}
            </div>

            <div class="nq-hero-banner__bottom">
              <div class="nq-hero-banner__info">
                <div class="nq-hero-banner__pills">
                  <app-status-badge [status]="spotlight.status" />
                  <span class="nq-chip">{{ spotlight.platform }}</span>
                </div>

                <h1>{{ spotlight.title }}</h1>
                @if (spotlight.status === 'playing') {
                  @if (featuredJournal(); as journal) {
                    @if (journal.lastCheckpoint) {
                      <p class="resume-note"><strong>Onde parei:</strong> {{ journal.lastCheckpoint }}</p>
                    }
                    @if (journal.nextObjective) {
                      <p class="resume-note"><strong>Próximo objetivo:</strong> {{ journal.nextObjective }}</p>
                    }
                  }
                  <a [routerLink]="['/backlog', spotlight.id]" fragment="diario">Abrir diário</a>
                }
              </div>

              <div class="nq-hero-banner__actions">
                <a
                  [routerLink]="['/backlog', spotlight.id]"
                  class="nq-icon-circle nq-icon-circle--glass"
                  aria-label="Editar jogo"
                  title="Editar jogo"
                >
                  <span class="ms-icon" aria-hidden="true">settings</span>
                </a>
                <button
                  type="button"
                  class="nq-icon-circle nq-icon-circle--glass"
                  aria-label="Adicionar novo jogo"
                  title="Adicionar novo jogo"
                  (click)="openCreateModal()"
                >
                  <span class="ms-icon" aria-hidden="true">add</span>
                </button>
                <a [routerLink]="['/backlog', spotlight.id]" class="nq-btn nq-btn--primary">
                  <span class="ms-icon ms-icon--filled" aria-hidden="true">play_arrow</span>
                  {{ spotlight.status === 'playing' ? 'Continuar jogando' : 'Abrir jogo' }}
                </a>
              </div>
            </div>
          </div>
        </section>
      } @else if (!loading()) {
        <section class="nq-hero-banner">
          <div class="nq-hero-banner__media" aria-hidden="true">
            <img src="jogando-coelho.webp" alt="" />
          </div>
          <div class="nq-hero-banner__content">
            <div class="nq-hero-banner__top">Sua biblioteca pessoal</div>
            <div class="nq-hero-banner__bottom">
              <div class="nq-hero-banner__info">
                <span class="nq-spotlight__eyebrow">
                  <span class="ms-icon" aria-hidden="true">sports_esports</span>
                  NextQuest
                </span>
                <h1>Comece sua coleção de jogos</h1>
                <p>
                  Adicione títulos manualmente ou importe do catálogo RAWG para acompanhar cada
                  etapa da sua jornada.
                </p>
              </div>

              <div class="nq-hero-banner__actions">
                <a routerLink="/catalog" class="nq-btn nq-btn--secondary">
                  <span class="ms-icon" aria-hidden="true">travel_explore</span>
                  Explorar RAWG
                </a>
                <button type="button" class="nq-btn nq-btn--primary" (click)="openCreateModal()">
                  <span class="ms-icon" aria-hidden="true">add</span>
                  Adicionar jogo
                </button>
              </div>
            </div>
          </div>
        </section>
      }

      <section class="nq-bento-row" aria-label="Resumo e atividade recente">
        <article class="nq-bento-card">
          <div class="nq-bento-header">
            <h2>Conquistas</h2>
            <a
              [routerLink]="steamAchievements() ? ['/steam', steamAchievements()!.appId] : ['/steam']"
              class="nq-icon-circle nq-icon-circle--sm"
              aria-label="Ver conquistas Steam"
              title="Ver conquistas Steam"
            >
              <span class="ms-icon" aria-hidden="true">chevron_right</span>
            </a>
          </div>

          @if (steamAchievements(); as ach) {
            <div class="bento-stat">
              <strong>{{ ach.unlockedCount }}/{{ ach.totalCount }} ({{ steamAchPct() }}%)</strong>
              <div class="nq-progress-track">
                <div class="nq-progress-fill" [style.width.%]="steamAchPct()"></div>
              </div>
            </div>

            <span class="bento-subtitle">Últimas desbloqueadas · {{ ach.gameName }}</span>

            <div class="nq-mini-list">
              @for (item of topAchievements(); track item.apiName) {
                <a class="nq-mini-item" [routerLink]="['/steam', ach.appId]">
                  <span class="nq-mini-item__thumb">
                    @if ((item.achieved ? item.iconUrl : item.grayIconUrl) || item.iconUrl; as img) {
                      <img [src]="img" [alt]="item.name" />
                    } @else {
                      <span class="ms-icon" aria-hidden="true">emoji_events</span>
                    }
                  </span>
                  <span class="nq-mini-item__body">
                    <strong>{{ item.name }}</strong>
                    <small>{{ item.description || (item.achieved ? 'Desbloqueada' : 'Bloqueada') }}</small>
                  </span>
                </a>
              }
            </div>
          } @else {
            <div class="bento-stat">
              <strong>
                {{ backlogProgress().completed }}/{{ backlogProgress().total }}
                ({{ backlogProgress().pct }}%) zerados
              </strong>
              <div class="nq-progress-track">
                <div class="nq-progress-fill" [style.width.%]="backlogProgress().pct"></div>
              </div>
            </div>

            <span class="bento-subtitle">
              Recentes na biblioteca ·
              <a routerLink="/steam" class="inline-link">Conectar Steam</a>
            </span>

            <div class="nq-mini-list">
              @for (item of games().slice(0, 3); track item.id) {
                <a class="nq-mini-item" [routerLink]="['/backlog', item.id]">
                  <span class="nq-mini-item__thumb">
                    @if (item.coverUrl; as cover) {
                      <img [src]="cover" [alt]="item.title" />
                    } @else {
                      <span>{{ item.title.slice(0, 2).toUpperCase() }}</span>
                    }
                  </span>
                  <span class="nq-mini-item__body">
                    <strong>{{ item.title }}</strong>
                    <small>{{ item.platform }}</small>
                  </span>
                </a>
              } @empty {
                <p class="bento-empty">Nenhum jogo cadastrado nesta página.</p>
              }
            </div>
          }
        </article>

        <article class="nq-bento-card">
          <div class="nq-bento-header">
            <h2>Na sua fila</h2>
            <button
              type="button"
              class="nq-icon-circle nq-icon-circle--sm"
              aria-label="Ir para biblioteca completa"
              title="Ver biblioteca completa"
              (click)="scrollToLibrary()"
            >
              <span class="ms-icon" aria-hidden="true">chevron_right</span>
            </button>
          </div>

          <div class="nq-mini-list">
            @for (item of queueGames(); track item.id) {
              <a class="nq-mini-item" [routerLink]="['/backlog', item.id]">
                <span class="nq-mini-item__thumb nq-mini-item__thumb--round">
                  @if (item.coverUrl; as cover) {
                    <img [src]="cover" [alt]="item.title" />
                  } @else {
                    <span>{{ item.title.slice(0, 2).toUpperCase() }}</span>
                  }
                </span>
                <span class="nq-mini-item__body">
                  <strong>{{ item.title }}</strong>
                  <small>
                    <span class="ms-icon" aria-hidden="true">devices</span>
                    {{ item.platform }} ·
                    <span class="ms-icon" aria-hidden="true">calendar_today</span>
                    {{ item.createdAt | date: 'dd/MM' }}
                  </small>
                </span>
                <app-status-badge [status]="item.status" />
              </a>
            } @empty {
              <p class="bento-empty">Adicione jogos para acompanhar sua fila aqui.</p>
            }
          </div>
        </article>

        <article class="nq-bento-card">
          <div class="nq-bento-header">
            <h2>Atividade</h2>
            <span class="nq-chip">28 dias</span>
          </div>

          <div class="nq-heatmap-legend" aria-label="Legenda de atividade">
            <span><i class="nq-heat-swatch nq-heat-cell is-lv0"></i> 0</span>
            <span><i class="nq-heat-swatch nq-heat-cell is-lv1"></i> 1</span>
            <span><i class="nq-heat-swatch nq-heat-cell is-lv2"></i> 2</span>
            <span><i class="nq-heat-swatch nq-heat-cell is-lv3"></i> 3+</span>
          </div>

          <div class="nq-heatmap-grid" role="grid" aria-label="Atividade dos últimos 28 dias">
            @for (day of activityDays(); track day.dateKey) {
              <div
                class="nq-heat-cell"
                [class]="'nq-heat-cell is-lv' + day.level"
                [title]="day.label + ': ' + day.count + ' registro(s)'"
              ></div>
            }
          </div>

          <div class="nq-heatmap-days" aria-hidden="true">
            <span>Seg</span>
            <span>Ter</span>
            <span>Qua</span>
            <span>Qui</span>
            <span>Sex</span>
            <span>Sáb</span>
            <span>Dom</span>
          </div>
        </article>
      </section>

      <app-play-queue />

      <section id="biblioteca-completa" class="library-section">
        <div class="toolbar">
          <div class="nq-tabs" role="tablist" aria-label="Filtrar por status">
            @for (tab of statusTabs; track tab.label) {
              <button
                type="button"
                class="nq-tab"
                [class.is-active]="selectedStatus() === tab.value"
                (click)="selectStatus(tab.value)"
              >
                <span class="ms-icon" aria-hidden="true">{{ tab.icon }}</span>
                {{ tab.label }}
              </button>
            }
          </div>

          <div class="toolbar__right">
            <form class="search-box" (ngSubmit)="applySearch()">
              <span class="ms-icon search-box__icon" aria-hidden="true">search</span>
              <input
                type="search"
                name="search"
                [(ngModel)]="searchTerm"
                placeholder="Filtrar biblioteca..."
                aria-label="Filtrar biblioteca"
              />
              <button type="submit" class="nq-btn nq-btn--secondary">Buscar</button>
            </form>

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
        </div>

        <app-feedback-banner [message]="errorMessage()" tone="error" />

        @if (loading()) {
          <div class="nq-skeleton-grid" aria-label="Carregando biblioteca">
            @for (item of skeletonItems; track item) {
              <div class="nq-skeleton-card"></div>
            }
          </div>
        } @else if (games().length === 0) {
          <div class="nq-empty">
            <h3>Nenhum jogo encontrado</h3>
            <p>Adicione um título manualmente ou importe diretamente do catálogo RAWG.</p>
            <div class="empty-actions">
              <button type="button" class="nq-btn nq-btn--primary" (click)="openCreateModal()">
                <span class="ms-icon" aria-hidden="true">add</span>
                Novo Jogo
              </button>
              <a routerLink="/catalog" class="nq-btn nq-btn--secondary">Explorar Catálogo RAWG</a>
            </div>
          </div>
        } @else {
          @if (viewMode() === 'grid') {
            <div class="nq-poster-grid">
              @for (game of games(); track game.id) {
                <a class="nq-poster-card" [routerLink]="['/backlog', game.id]">
                  <app-game-cover
                    [src]="game.coverUrl"
                    [title]="game.title"
                    aspectRatio="3 / 4"
                    scrim="strong"
                    [zoomOnHover]="true"
                  >
                    <div class="nq-poster-card__top">
                      <app-status-badge [status]="game.status" />
                      @if (game.rawgId) {
                        <span class="nq-chip">RAWG</span>
                      }
                    </div>

                    <div class="nq-poster-card__overlay">
                      <h3 class="nq-poster-card__title">{{ game.title }}</h3>
                      <div class="nq-poster-card__footer">
                        <span class="nq-chip">{{ game.platform }}</span>
                        <span class="ms-icon" aria-hidden="true">arrow_outward</span>
                      </div>
                    </div>
                  </app-game-cover>
                </a>
              }
            </div>
          } @else {
            <div class="nq-shelf-list">
              @for (game of games(); track game.id) {
                <a class="nq-shelf-row" [routerLink]="['/backlog', game.id]">
                  <div class="nq-shelf-row__thumb">
                    <app-game-cover
                      [src]="game.coverUrl"
                      [title]="game.title"
                      aspectRatio="3 / 4"
                      scrim="none"
                    />
                  </div>
                  <div class="nq-shelf-row__main">
                    <strong>{{ game.title }}</strong>
                    <small>{{ game.platform }}</small>
                  </div>
                  <span class="nq-chip nq-shelf-row__extra">{{ game.platform }}</span>
                  <app-status-badge [status]="game.status" />
                  <span class="nq-shelf-row__date nq-shelf-row__extra">
                    {{ game.createdAt | date: 'dd/MM/yyyy' }}
                  </span>
                  <span class="ms-icon" aria-hidden="true">chevron_right</span>
                </a>
              }
            </div>
          }

          <app-pagination
            [page]="page()"
            [hasMore]="hasMore()"
            (pageChange)="goToPage($event)"
          />
        }
      </section>

      @if (showCreate()) {
        <div class="nq-modal-backdrop" (click)="onBackdropClick($event)">
          <section
            class="nq-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="create-modal-title"
          >
            <div class="nq-modal__header">
              <h2 id="create-modal-title">Adicionar jogo ao backlog</h2>
              <button
                type="button"
                class="nq-btn nq-btn--ghost modal-close"
                aria-label="Fechar"
                (click)="closeCreateModal()"
              >
                <span class="ms-icon" aria-hidden="true">close</span>
              </button>
            </div>

            <form class="create-form" (ngSubmit)="createGame()">
              <div class="nq-field">
                <label for="new-title">Título</label>
                <input
                  id="new-title"
                  name="newTitle"
                  [(ngModel)]="newTitle"
                  required
                  placeholder="Ex: Hollow Knight"
                />
              </div>
              <div class="nq-field">
                <label for="new-platform">Plataforma</label>
                <input
                  id="new-platform"
                  name="newPlatform"
                  [(ngModel)]="newPlatform"
                  required
                  placeholder="Ex: PC / Steam"
                />
              </div>
              <div class="modal-actions">
                <button type="button" class="nq-btn nq-btn--ghost" (click)="closeCreateModal()">
                  Cancelar
                </button>
                <button type="submit" class="nq-btn nq-btn--primary" [disabled]="creating()">
                  <span class="ms-icon" aria-hidden="true">add</span>
                  {{ creating() ? 'Salvando...' : 'Adicionar ao Backlog' }}
                </button>
              </div>
            </form>
          </section>
        </div>
      }
    </div>
  `,
  styles: `
    .resume-note {
      display: -webkit-box;
      -webkit-box-orient: vertical;
      -webkit-line-clamp: 2;
      overflow: hidden;
      overflow-wrap: anywhere;
    }

    .bento-stat {
      display: flex;
      flex-direction: column;
      gap: 8px;

      strong {
        font-size: 1.05rem;
        font-variant-numeric: tabular-nums;
      }
    }

    .bento-subtitle {
      font-size: 0.8rem;
      color: var(--text-muted);
    }

    .inline-link {
      color: var(--accent-primary);
      text-decoration: none;
      font-weight: 600;
    }

    .bento-empty {
      margin: 0;
      color: var(--text-muted);
      font-size: 0.86rem;
    }

    .library-section {
      display: flex;
      flex-direction: column;
      gap: 18px;
    }

    .empty-actions,
    .toolbar__right {
      display: flex;
      gap: 10px;
      flex-wrap: wrap;
      align-items: center;
    }

    .toolbar {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 14px;
    }

    .search-box {
      position: relative;
      display: flex;
      gap: 8px;

      input {
        min-width: 220px;
        padding: 9px 13px 9px 36px;
        border-radius: 999px;
        border: 1px solid var(--border-subtle);
        background: var(--bg-surface);
        color: var(--text-primary);
        font-family: inherit;
      }
    }

    .search-box__icon {
      position: absolute;
      left: 12px;
      top: 50%;
      transform: translateY(-50%);
      color: var(--text-muted);
      font-size: 18px;
      pointer-events: none;
    }

    .nq-shelf-row__date {
      color: var(--text-muted);
      font-size: 0.8rem;
      font-variant-numeric: tabular-nums;
    }

    .nq-shelf-row {
      grid-template-columns: 56px 1fr auto auto auto auto;
    }

    .create-form {
      display: flex;
      flex-direction: column;
      gap: 14px;
    }

    .modal-close {
      padding: 6px;
    }

    .modal-actions {
      display: flex;
      justify-content: flex-end;
      gap: 10px;
      margin-top: 6px;
    }

    @media (max-width: 780px) {
      .nq-shelf-row {
        grid-template-columns: 48px 1fr auto auto;
      }
    }
  `,
})
export class BacklogListPageComponent implements OnInit {
  private readonly api = inject(BacklogApi);
  private readonly playPlan = inject(PlayPlanApi);
  private readonly steamApi = inject(SteamApi);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly statusTabs = STATUS_TABS;
  protected readonly skeletonItems = SKELETON_ITEMS;

  protected readonly games = signal<BacklogGame[]>([]);
  protected readonly steamAchievements = signal<SteamGameAchievements | null>(null);
  protected readonly selectedStatus = signal<GameStatus | null>(null);
  protected readonly viewMode = signal<'grid' | 'list'>('grid');
  protected readonly page = signal(1);
  protected readonly hasMore = signal(false);
  protected readonly loading = signal(true);
  protected readonly creating = signal(false);
  protected readonly showCreate = signal(false);
  protected readonly errorMessage = signal<string | null>(null);

  protected readonly featuredGame = computed(() => {
    const list = this.games();
    if (list.length === 0) return null;
    return list.find((g) => g.status === 'playing') ?? list[0];
  });

  private readonly playingId = computed(() => {
    const game = this.featuredGame();
    return game?.status === 'playing' ? game.id : null;
  });

  protected readonly featuredJournal = toSignal(toObservable(this.playingId).pipe(
    switchMap(id => id
      ? this.playPlan.journal(id).pipe(startWith(null), catchError(() => of(null)))
      : of(null)),
  ), { initialValue: null });

  protected readonly queueGames = computed(() => {
    const list = [...this.games()];
    list.sort((a, b) => Number(b.status === 'playing') - Number(a.status === 'playing'));
    return list.slice(0, 4);
  });

  protected readonly backlogProgress = computed(() => {
    const list = this.games();
    const total = list.length;
    const completed = list.filter((g) => g.status === 'completed').length;
    const pct = total === 0 ? 0 : Math.round((completed / total) * 100);
    return { completed, total, pct };
  });

  protected readonly steamAchPct = computed(() => {
    const ach = this.steamAchievements();
    if (!ach || ach.totalCount === 0) return 0;
    return Math.round((ach.unlockedCount / ach.totalCount) * 100);
  });

  protected readonly topAchievements = computed(() => {
    const list = [...(this.steamAchievements()?.achievements ?? [])];
    list.sort((a, b) => {
      if (a.achieved !== b.achieved) return Number(b.achieved) - Number(a.achieved);
      return (b.unlockedAt ?? '').localeCompare(a.unlockedAt ?? '');
    });
    return list.slice(0, 3);
  });

  protected readonly activityDays = computed(() => {
    const backlogDates = this.games().map((g) => g.createdAt);
    const steamAchDates = (this.steamAchievements()?.achievements ?? []).map((a) => a.unlockedAt);
    return buildActivityHeatmap([...backlogDates, ...steamAchDates]);
  });

  protected searchTerm = '';
  protected newTitle = '';
  protected newPlatform = '';

  private initialized = false;

  ngOnInit(): void {
    this.route.queryParamMap
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((params) => {
        const rawStatus = params.get('status');
        const parsedStatus: GameStatus | null =
          rawStatus === 'planned' ||
          rawStatus === 'playing' ||
          rawStatus === 'completed' ||
          rawStatus === 'dropped'
            ? rawStatus
            : null;

        this.showCreate.set(params.get('novo') === '1');

        const statusChanged = this.selectedStatus() !== parsedStatus;
        if (!this.initialized || statusChanged) {
          this.initialized = true;
          this.selectedStatus.set(parsedStatus);
          this.page.set(1);
          this.load();
        }
      });

    this.loadSteamHighlight();
  }

  @HostListener('document:keydown.escape')
  protected onEscapeKey(): void {
    if (this.showCreate()) {
      this.closeCreateModal();
    }
  }

  protected scrollToLibrary(): void {
    document.getElementById('biblioteca-completa')?.scrollIntoView({ behavior: 'smooth' });
  }

  protected openCreateModal(): void {
    this.showCreate.set(true);
  }

  protected closeCreateModal(): void {
    this.showCreate.set(false);
    if (this.route.snapshot.queryParamMap.has('novo')) {
      void this.router.navigate([], {
        relativeTo: this.route,
        queryParams: { novo: null },
        queryParamsHandling: 'merge',
      });
    }
  }

  protected onBackdropClick(event: MouseEvent): void {
    if (event.target === event.currentTarget) {
      this.closeCreateModal();
    }
  }

  protected selectStatus(status: GameStatus | null): void {
    this.selectedStatus.set(status);
    this.page.set(1);
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { status: status ?? null },
      queryParamsHandling: 'merge',
    });
    this.load();
  }

  protected applySearch(): void {
    this.page.set(1);
    this.load();
  }

  protected goToPage(nextPage: number): void {
    this.page.set(nextPage);
    this.load();
  }

  protected createGame(): void {
    const title = this.newTitle.trim();
    const platform = this.newPlatform.trim();
    if (!title || !platform) return;

    this.creating.set(true);
    this.errorMessage.set(null);

    this.api.create({ title, platform }).subscribe({
      next: () => {
        this.creating.set(false);
        this.newTitle = '';
        this.newPlatform = '';
        this.closeCreateModal();
        this.page.set(1);
        this.load();
      },
      error: (err) => {
        this.creating.set(false);
        this.errorMessage.set(parseApiError(err).message);
      },
    });
  }

  private loadSteamHighlight(): void {
    this.steamApi
      .getLibrary()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (lib) => {
          const games = [...(lib.games ?? [])];
          if (games.length === 0) return;

          games.sort((a, b) => {
            const recentDiff =
              (b.playtimeTwoWeeksMinutes ?? 0) - (a.playtimeTwoWeeksMinutes ?? 0);
            return recentDiff !== 0
              ? recentDiff
              : b.playtimeForeverMinutes - a.playtimeForeverMinutes;
          });

          const topGame = games[0];
          this.steamApi
            .getAchievements(topGame.appId)
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
              next: (ach) => this.steamAchievements.set(ach),
              error: () => {
                // Silencia erro quando conquistas estão privadas/indisponíveis.
              },
            });
        },
        error: () => {
          // Silencia erro quando conta Steam não está vinculada.
        },
      });
  }

  private load(): void {
    this.loading.set(true);
    this.errorMessage.set(null);

    this.api.list(this.searchTerm, this.selectedStatus(), this.page()).subscribe({
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
