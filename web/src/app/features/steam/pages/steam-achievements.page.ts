import { DatePipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { parseApiError } from '../../../core/errors/problem-details';
import { SteamGameAchievements } from '../../../core/models/api.models';
import { FeedbackBannerComponent } from '../../../shared/components/feedback-banner.component';
import { PaginationComponent } from '../../../shared/components/pagination.component';
import { SteamApi } from '../services/steam.api';

type AchievementFilter = 'all' | 'unlocked' | 'locked';

@Component({
  selector: 'app-steam-achievements-page',
  standalone: true,
  imports: [PaginationComponent, DatePipe, RouterLink, FeedbackBannerComponent],
  template: `
    <div class="nq-page">
      <div>
        <a routerLink="/steam" class="nq-btn nq-btn--ghost">
          <span class="ms-icon" aria-hidden="true">arrow_back</span>
          Voltar à Biblioteca Steam
        </a>
      </div>

      <app-feedback-banner [message]="errorMessage()" tone="error" />

      @if (loading()) {
        <div class="nq-card">Carregando conquistas...</div>
      } @else if (data(); as ach) {
        <section class="nq-hero-banner">
          <div class="nq-hero-banner__media" aria-hidden="true">
            <img [src]="steamHeaderUrl(ach.appId)" alt="" />
          </div>

          <div class="nq-hero-banner__content">
            <div class="nq-hero-banner__top">Steam App #{{ ach.appId }}</div>

            <div class="nq-hero-banner__bottom">
              <div class="nq-hero-banner__info">
                <div class="nq-hero-banner__pills">
                  <span class="nq-chip nq-chip--accent">
                    <span class="ms-icon chip-icon" aria-hidden="true">emoji_events</span>
                    Conquistas Steam
                  </span>
                </div>
                <h1>{{ ach.gameName }}</h1>
                <p>{{ ach.unlockedCount }} de {{ ach.totalCount }} conquistas desbloqueadas</p>
                <div class="progress-wrap">
                  <div class="nq-progress-track">
                    <div class="nq-progress-fill" [style.width.%]="progressPct()"></div>
                  </div>
                </div>
              </div>

              <div class="pct-card">
                <span class="pct-value">{{ progressPct() }}%</span>
                <small>Concluído</small>
              </div>
            </div>
          </div>
        </section>

        <div class="nq-tabs" role="tablist" aria-label="Filtrar conquistas">
          <button
            type="button"
            class="nq-tab"
            [class.is-active]="filter() === 'all'"
            (click)="setFilter('all')"
          >
            <span class="ms-icon" aria-hidden="true">apps</span>
            Todas ({{ ach.achievements.length }})
          </button>
          <button
            type="button"
            class="nq-tab"
            [class.is-active]="filter() === 'unlocked'"
            (click)="setFilter('unlocked')"
          >
            <span class="ms-icon" aria-hidden="true">check_circle</span>
            Desbloqueadas ({{ ach.unlockedCount }})
          </button>
          <button
            type="button"
            class="nq-tab"
            [class.is-active]="filter() === 'locked'"
            (click)="setFilter('locked')"
          >
            <span class="ms-icon" aria-hidden="true">lock</span>
            Bloqueadas ({{ ach.totalCount - ach.unlockedCount }})
          </button>
        </div>

        @if (filteredAchievements().length === 0) {
          <div class="nq-empty">
            <h3>Nenhuma conquista nesta categoria</h3>
            <p>Alterne o filtro acima para visualizar outras conquistas.</p>
          </div>
        } @else {
          <div class="ach-list">
            @for (item of pageItems(); track item.apiName) {
              <article class="nq-card ach-item" [class.is-locked]="!item.achieved">
                <img
                  class="ach-icon"
                  [src]="(item.achieved ? item.iconUrl : item.grayIconUrl) || item.iconUrl || ''"
                  [alt]="item.name"
                />
                <div class="ach-info">
                  <h3>{{ item.name }}</h3>
                  <p>{{ item.description || 'Conquista oculta' }}</p>
                </div>
                <div class="ach-status">
                  @if (item.achieved) {
                    <span class="nq-chip nq-chip--accent">Desbloqueada</span>
                    @if (item.unlockedAt) {
                      <small>{{ item.unlockedAt | date: 'dd/MM/yyyy' }}</small>
                    }
                  } @else {
                    <span class="nq-chip">Bloqueada</span>
                  }
                </div>
              </article>
            }
          </div>

          <app-pagination
            [page]="page()"
            [hasMore]="page() < totalPages()"
            [totalPages]="totalPages()"
            (pageChange)="page.set($event)"
          />
        }
      }
    </div>
  `,
  styles: `
    .chip-icon {
      font-size: 15px;
    }

    .progress-wrap {
      max-width: 420px;
      width: 100%;
    }

    .pct-card {
      padding: 16px 24px;
      border-radius: var(--radius-lg);
      background: rgba(16, 17, 19, 0.78);
      backdrop-filter: blur(10px);
      border: 1px solid var(--border-glow);
      text-align: center;

      small {
        display: block;
        color: var(--text-secondary);
        font-size: 0.78rem;
        margin-top: 4px;
      }
    }

    .pct-value {
      display: block;
      font-size: 2.1rem;
      font-weight: 800;
      color: var(--accent-primary);
      font-variant-numeric: tabular-nums;
      line-height: 1;
    }

    .ach-list {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .ach-item {
      display: flex;
      align-items: center;
      gap: 16px;

      &.is-locked {
        opacity: 0.65;
      }
    }

    .ach-icon {
      width: 52px;
      height: 52px;
      border-radius: var(--radius-sm);
      object-fit: cover;
      background: var(--bg-input);
    }

    .ach-info {
      flex: 1;

      h3 {
        margin: 0 0 4px;
        font-size: 1rem;
      }

      p {
        margin: 0;
        color: var(--text-secondary);
        font-size: 0.88rem;
      }
    }

    .ach-status {
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      gap: 4px;

      small {
        color: var(--text-muted);
        font-size: 0.78rem;
      }
    }
  `,
})
export class SteamAchievementsPageComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly api = inject(SteamApi);

  protected readonly data = signal<SteamGameAchievements | null>(null);
  protected readonly loading = signal(true);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly filter = signal<AchievementFilter>('all');

  protected readonly progressPct = computed(() => {
    const ach = this.data();
    if (!ach || ach.totalCount === 0) return 0;
    return Math.round((ach.unlockedCount / ach.totalCount) * 100);
  });

  protected readonly filteredAchievements = computed(() => {
    const list = this.data()?.achievements ?? [];
    const currentFilter = this.filter();
    if (currentFilter === 'unlocked') return list.filter((a) => a.achieved);
    if (currentFilter === 'locked') return list.filter((a) => !a.achieved);
    return list;
  });

  protected readonly page = signal(1);
  private readonly pageSize = 20;
  protected readonly totalPages = computed(() =>
    Math.ceil(this.filteredAchievements().length / this.pageSize),
  );
  protected readonly pageItems = computed(() => {
    const start = (this.page() - 1) * this.pageSize;
    return this.filteredAchievements().slice(start, start + this.pageSize);
  });

  ngOnInit(): void {
    const appId = Number(this.route.snapshot.paramMap.get('appId'));
    this.api.getAchievements(appId).subscribe({
      next: (res) => {
        this.data.set(res);
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        this.errorMessage.set(parseApiError(err).message);
      },
    });
  }

  protected setFilter(next: AchievementFilter): void {
    this.filter.set(next);
    this.page.set(1);
  }

  protected steamHeaderUrl(appId: number): string {
    return `https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/${appId}/header.jpg`;
  }
}
