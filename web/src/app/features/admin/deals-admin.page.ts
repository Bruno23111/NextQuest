import { CurrencyPipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { API_BASE_URL } from '../../core/config/api.config';
import { parseApiError } from '../../core/errors/problem-details';
import { FeedbackBannerComponent } from '../../shared/components/feedback-banner.component';
import { PopularBatchComponent } from './popular-batch.component';

interface DealPreview {
  previewId: string;
  items: { title: string; shop: string; price: number; currency: string; discount: number }[];
  nextOffset: number | null;
}

const SKELETON_ITEMS = [0, 1, 2, 3, 4, 5, 6, 7];

@Component({
  standalone: true,
  imports: [CurrencyPipe, FormsModule, RouterLink, FeedbackBannerComponent, PopularBatchComponent],
  template: `
    <div class="nq-page">
      <section class="nq-hero">
        <div class="admin-hero__intro">
          <span class="nq-spotlight__eyebrow">
            <span class="ms-icon" aria-hidden="true">admin_panel_settings</span>
            Administração
          </span>
          <h1 class="admin-hero__title">Administração de promoções</h1>
          <p>Consulte o IsThereAnyDeal e escolha quais ofertas publicar por até 24 horas.</p>

          <nav class="nq-tabs admin-nav" aria-label="Seções administrativas">
            <a routerLink="/admin" class="nq-tab">
              <span class="ms-icon" aria-hidden="true">sports_esports</span>
              Catálogo
            </a>
            <a routerLink="/admin/deals" class="nq-tab is-active" aria-current="page">
              <span class="ms-icon" aria-hidden="true">local_offer</span>
              Promoções
            </a>
          </nav>
        </div>

        <form class="deal-admin-search" (ngSubmit)="search(query.trim(), popular && !query.trim(), 0)">
          <label class="sr-only" for="deal-title">Título do jogo</label>
          <div class="deal-admin-search__input">
            <span class="ms-icon" aria-hidden="true">search</span>
            <input
              id="deal-title"
              type="search"
              name="query"
              [(ngModel)]="query"
              maxlength="120"
              placeholder="Título do jogo (opcional)"
            />
          </div>

          <label
            class="deal-popular"
            [class.is-active]="popular && !query.trim()"
            [class.is-disabled]="busy() || !!query.trim()"
          >
            <input
              class="deal-popular__input"
              type="checkbox"
              name="popular"
              [(ngModel)]="popular"
              [disabled]="busy() || !!query.trim()"
            />
            <span class="ms-icon deal-popular__icon" aria-hidden="true">local_fire_department</span>
            <span class="deal-popular__label">Populares</span>
            <span class="deal-popular__switch" aria-hidden="true"></span>
          </label>

          <button type="submit" class="nq-btn nq-btn--primary" [disabled]="busy()">
            <span class="ms-icon" aria-hidden="true">search</span>
            {{ searching() ? 'Consultando...' : 'Consultar ofertas' }}
          </button>
        </form>
      </section>

      <app-popular-batch source="deals" />

      <app-feedback-banner [message]="error()" tone="error" [inline]="true" />
      <app-feedback-banner [message]="notice()" tone="success" />

      @if (searching()) {
        <div class="nq-skeleton-grid" role="status" aria-label="Consultando ofertas no IsThereAnyDeal">
          @for (item of skeletonItems; track item) {
            <div class="nq-skeleton-card deal-admin-skeleton"></div>
          }
        </div>
      } @else if (preview(); as result) {
        <div class="section-heading">
          <h2>
            @if (lastQuery) {
              Ofertas para "{{ lastQuery }}"
            } @else if (lastPopular) {
              Ofertas de jogos populares
            } @else {
              Ofertas encontradas
            }
          </h2>
          @if (result.items.length > 0) {
            <span class="nq-chip">{{ result.items.length }} ofertas nesta página</span>
          }
        </div>

        @if (result.items.length === 0) {
          <div class="nq-empty">
            <h3>Nenhuma oferta encontrada</h3>
            <p>Tente outro título ou ajuste o filtro de jogos populares.</p>
          </div>
        } @else {
          <div class="nq-grid">
            @for (offer of result.items; track $index) {
              <article class="nq-card deal-admin-card">
                <div class="deal-admin-card__top">
                  <span class="nq-chip">{{ offer.shop }}</span>
                  @if (offer.discount > 0) {
                    <span class="nq-chip nq-chip--accent">-{{ offer.discount }}%</span>
                  }
                </div>

                <h3 class="deal-admin-card__title">{{ offer.title }}</h3>

                <div class="deal-admin-card__price">
                  {{ offer.price | currency: offer.currency }}
                </div>

                <div class="deal-admin-card__actions">
                  @if (published().has($index)) {
                    <button
                      type="button"
                      class="nq-btn nq-btn--secondary published-btn deal-admin-card__cta"
                      disabled
                    >
                      <span class="ms-icon" aria-hidden="true">check</span>
                      Publicada
                    </button>
                  } @else {
                    <button
                      type="button"
                      class="nq-btn nq-btn--primary deal-admin-card__cta"
                      [disabled]="busy()"
                      (click)="publish(result, $index)"
                    >
                      <span class="ms-icon" aria-hidden="true">publish</span>
                      {{ publishingIndex() === $index ? 'Publicando...' : 'Publicar oferta' }}
                    </button>
                  }
                </div>
              </article>
            }
          </div>

          @if (result.nextOffset !== null) {
            <div class="deal-admin-pagination">
              <button
                type="button"
                class="nq-btn nq-btn--secondary"
                [disabled]="busy()"
                (click)="search(lastQuery, lastPopular, result.nextOffset)"
              >
                Próxima página
                <span class="ms-icon" aria-hidden="true">chevron_right</span>
              </button>
            </div>
          }
        }
      } @else {
        <div class="nq-empty deal-admin-empty">
          <span class="ms-icon deal-admin-empty__icon" aria-hidden="true">local_offer</span>
          <h3>Pronto para consultar ofertas</h3>
          <p>Informe um título ou filtre por jogos populares para visualizar e publicar promoções.</p>
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

    .deal-admin-search {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 10px;
    }

    .deal-admin-search__input {
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

    .deal-popular {
      position: relative;
      display: inline-flex;
      align-items: center;
      gap: 10px;
      padding: 8px 12px;
      border-radius: 999px;
      border: 1px solid var(--border-subtle);
      background: var(--bg-input);
      cursor: pointer;
      user-select: none;
      font-size: 0.86rem;
      font-weight: 600;
      color: var(--text-secondary);
      transition: border-color 0.18s ease, background-color 0.18s ease, color 0.18s ease;

      &:hover:not(.is-disabled) {
        border-color: var(--border-strong);
        color: var(--text-primary);
      }

      &.is-active {
        border-color: var(--border-glow);
        background: color-mix(in srgb, var(--accent-primary) 10%, var(--bg-surface));
        color: var(--text-primary);

        .deal-popular__icon {
          color: var(--accent-primary);
        }

        .deal-popular__switch {
          background: var(--accent-primary);
        }

        .deal-popular__switch::after {
          transform: translateX(16px);
          background: #101113;
        }
      }

      &.is-disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
    }

    .deal-popular__input {
      position: absolute;
      opacity: 0;
      width: 1px;
      height: 1px;
      margin: 0;
      pointer-events: none;
    }

    .deal-popular__icon {
      font-size: 18px;
      color: var(--text-muted);
      transition: color 0.18s ease;
    }

    .deal-popular__switch {
      position: relative;
      width: 36px;
      height: 20px;
      border-radius: 999px;
      background: var(--bg-surface-hover);
      border: 1px solid var(--border-strong);
      flex-shrink: 0;
      transition: background-color 0.18s ease, border-color 0.18s ease;

      &::after {
        content: '';
        position: absolute;
        top: 2px;
        left: 2px;
        width: 14px;
        height: 14px;
        border-radius: 50%;
        background: var(--text-secondary);
        transition: transform 0.18s ease, background-color 0.18s ease;
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

    .deal-admin-card {
      display: flex;
      flex-direction: column;
      gap: 12px;
      transition: transform 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease;

      &:hover {
        transform: translateY(-3px);
        border-color: var(--border-glow);
        box-shadow: var(--shadow-glow);
      }
    }

    .deal-admin-card__top {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
    }

    .deal-admin-card__title {
      margin: 0;
      font-size: 1rem;
      font-weight: 600;
      line-height: 1.35;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }

    .deal-admin-card__price {
      font-size: 1.3rem;
      font-weight: 800;
      color: var(--accent-primary);
      font-variant-numeric: tabular-nums;
    }

    .deal-admin-card__actions {
      margin-top: auto;
      padding-top: 4px;
      display: flex;
    }

    .deal-admin-card__cta {
      width: 100%;
      padding: 10px 12px;
      font-size: 0.85rem;
    }

    .published-btn {
      color: var(--color-success);
      border-color: color-mix(in srgb, var(--color-success) 45%, transparent);
    }

    .deal-admin-pagination {
      display: flex;
      justify-content: center;
      margin-block: 8px 16px;
    }

    .deal-admin-skeleton {
      aspect-ratio: 4 / 3;
    }

    .deal-admin-empty__icon {
      font-size: 40px;
      color: var(--accent-primary);
      margin-bottom: 10px;
    }

    .deal-admin-empty p {
      margin-bottom: 0;
    }

    @media (max-width: 540px) {
      .deal-admin-search {
        width: 100%;
      }

      .deal-admin-search__input {
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
export class DealsAdminPage {
  private readonly http = inject(HttpClient);
  private readonly url = inject(API_BASE_URL) + '/admin/deals/preview';
  private readonly destroyRef = inject(DestroyRef);

  protected readonly skeletonItems = SKELETON_ITEMS;
  protected query = '';
  protected popular = false;
  protected lastQuery = '';
  protected lastPopular = false;
  protected readonly preview = signal<DealPreview | null>(null);
  protected readonly published = signal(new Set<number>());
  protected readonly searching = signal(false);
  protected readonly publishingIndex = signal<number | null>(null);
  protected readonly busy = computed(() => this.searching() || this.publishingIndex() !== null);
  protected readonly error = signal('');
  protected readonly notice = signal('');

  protected search(q: string, popular: boolean, offset: number): void {
    this.searching.set(true);
    this.error.set('');
    this.notice.set('');
    this.http
      .get<DealPreview>(this.url, { params: { q, popular, offset } })
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.searching.set(false)),
      )
      .subscribe({
        next: (result) => {
          this.lastQuery = q;
          this.lastPopular = popular;
          this.preview.set(result);
          this.published.set(new Set());
        },
        error: (error: unknown) => this.error.set(parseApiError(error).message),
      });
  }

  protected publish(preview: DealPreview, index: number): void {
    this.publishingIndex.set(index);
    this.error.set('');
    this.notice.set('');
    this.http
      .put<void>(`${this.url}/${preview.previewId}/${index}`, null)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.publishingIndex.set(null)),
      )
      .subscribe({
        next: () => {
          this.published.update((items) => new Set(items).add(index));
          this.notice.set('Oferta publicada.');
        },
        error: (error: unknown) => this.error.set(parseApiError(error).message),
      });
  }
}
