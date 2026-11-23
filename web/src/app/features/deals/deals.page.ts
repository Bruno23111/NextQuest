import { CurrencyPipe, registerLocaleData } from '@angular/common';
import localePt from '@angular/common/locales/pt';
import { HttpClient } from '@angular/common/http';
import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { finalize } from 'rxjs';
import { API_BASE_URL } from '../../core/config/api.config';
import { parseApiError } from '../../core/errors/problem-details';
import { FeedbackBannerComponent } from '../../shared/components/feedback-banner.component';
import { GameCoverComponent } from '../../shared/components/game-cover.component';
import { PaginationComponent } from '../../shared/components/pagination.component';
import { SelectComponent, SelectOption } from '../../shared/components/select.component';

registerLocaleData(localePt, 'pt-BR');

type DealSort = 'discount' | 'price';
type DealShop = '' | 'steam' | 'gog' | 'nuuvem';

interface GameDeal {
  id: string;
  title: string;
  shop: string;
  price: number;
  regularPrice: number | null;
  currency: string;
  discount: number;
  url: string;
  coverUrl: string | null;
}

interface DealsPage {
  items: GameDeal[];
  nextOffset: number | null;
}

const SHOP_OPTIONS: readonly SelectOption<DealShop>[] = [
  { value: '', label: 'Todas as lojas' },
  { value: 'steam', label: 'Steam' },
  { value: 'gog', label: 'GOG' },
  { value: 'nuuvem', label: 'Nuuvem' },
];

const SKELETON_ITEMS = [0, 1, 2, 3, 4, 5, 6, 7];

@Component({
  selector: 'app-deals-page',
  standalone: true,
  imports: [
    FormsModule,
    CurrencyPipe,
    FeedbackBannerComponent,
    GameCoverComponent,
    PaginationComponent,
    SelectComponent,
  ],
  template: `
    <div class="nq-page">
      <header class="nq-hero">
        <div>
          <span class="nq-spotlight__eyebrow">
            <span class="ms-icon" aria-hidden="true">local_offer</span>
            Ofertas PC · Brasil
          </span>
          <h1 class="deals-title">Promoções</h1>
          <p>
            Acompanhe descontos em jogos de PC via
            <a href="https://isthereanydeal.com/" target="_blank" rel="noopener noreferrer">
              IsThereAnyDeal
            </a>
          </p>
        </div>

        <div class="nq-tabs" role="group" aria-label="Ordenar promoções">
          <button
            type="button"
            class="nq-tab"
            [disabled]="loading()"
            [class.is-active]="sort() === 'discount'"
            [attr.aria-pressed]="sort() === 'discount'"
            (click)="changeSort('discount')"
          >
            <span class="ms-icon" aria-hidden="true">percent</span>
            Maior desconto
          </button>
          <button
            type="button"
            class="nq-tab"
            [disabled]="loading()"
            [class.is-active]="sort() === 'price'"
            [attr.aria-pressed]="sort() === 'price'"
            (click)="changeSort('price')"
          >
            <span class="ms-icon" aria-hidden="true">sell</span>
            Menor preço
          </button>
        </div>
      </header>

      <form class="deal-search" (ngSubmit)="submitSearch()">
        <div class="deal-search__input">
          <span class="ms-icon" aria-hidden="true">search</span>
          <input
            type="search"
            name="title"
            [(ngModel)]="searchText"
            maxlength="120"
            placeholder="Pesquisar jogo em promoção…"
            aria-label="Pesquisar jogo em promoção"
          />
        </div>

        <div class="deal-shop">
          <app-select
            [options]="shopOptions"
            [value]="shop()"
            [disabled]="loading()"
            ariaLabel="Plataforma ou loja"
            (valueChange)="changeShop($event)"
          />
        </div>

        <button type="submit" class="nq-btn nq-btn--primary" [disabled]="loading()">
          <span class="ms-icon" aria-hidden="true">search</span>
          Buscar
        </button>

        @if (query()) {
          <button
            type="button"
            class="nq-btn nq-btn--ghost"
            [disabled]="loading()"
            (click)="clearSearch()"
          >
            <span class="ms-icon" aria-hidden="true">close</span>
            Limpar busca
          </button>
        }
      </form>

      @if (!query()) {
        <div class="deal-filters-row">
          <label class="deal-popular" [class.is-active]="popular()" [class.is-disabled]="loading()">
            <input
              class="deal-popular__input"
              type="checkbox"
              [ngModel]="popular()"
              (ngModelChange)="changePopularity($event)"
              [disabled]="loading()"
            />
            <span class="ms-icon deal-popular__icon" aria-hidden="true">local_fire_department</span>
            <span class="deal-popular__text">
              <strong>Jogos populares</strong>
              <small>1.000+ avaliações na Steam</small>
            </span>
            <span class="deal-popular__switch" aria-hidden="true"></span>
          </label>
        </div>
      }

      @if (loading()) {
        <div class="nq-skeleton-grid" role="status" aria-label="Carregando promoções">
          @for (item of skeletonItems; track item) {
            <div class="nq-skeleton-card"></div>
          }
        </div>
      } @else if (error()) {
        <section class="nq-card error-box">
          <app-feedback-banner [message]="error()" tone="error" />
          <div>
            <button type="button" class="nq-btn nq-btn--secondary" (click)="load()">
              <span class="ms-icon" aria-hidden="true">refresh</span>
              Tentar novamente
            </button>
          </div>
        </section>
      } @else if (result(); as current) {
        @if (current.items.length === 0) {
          <div class="nq-empty">
            <h3>Nenhuma oferta encontrada</h3>
            @if (query(); as title) {
              <p>Nenhuma promoção encontrada para “{{ title }}”.</p>
              <button type="button" class="nq-btn nq-btn--primary" (click)="clearSearch()">
                Limpar filtro
              </button>
            } @else {
              <p>Nenhuma oferta disponível nesta página.</p>
            }
          </div>
        } @else {
          <div class="nq-poster-grid">
            @for (offer of current.items; track offer.id) {
              <article class="nq-game-card">
                <app-game-cover
                  [src]="offer.coverUrl"
                  [title]="offer.title"
                  aspectRatio="3 / 4"
                  [zoomOnHover]="true"
                >
                  <div class="nq-poster-card__top">
                    <span class="nq-chip">{{ offer.shop }}</span>
                    @if (offer.discount > 0) {
                      <span class="nq-chip nq-chip--accent">-{{ offer.discount }}%</span>
                    }
                  </div>
                </app-game-cover>

                <div class="nq-game-card__body">
                  <h2 class="nq-game-card__title">{{ offer.title }}</h2>

                  <div class="prices">
                    @if (offer.regularPrice != null && offer.regularPrice > offer.price) {
                      <del>{{ offer.regularPrice | currency: offer.currency : 'symbol' : '1.2-2' : 'pt-BR' }}</del>
                    }
                    <strong>{{ offer.price | currency: offer.currency : 'symbol' : '1.2-2' : 'pt-BR' }}</strong>
                  </div>

                  <a
                    class="nq-btn nq-btn--primary deal-cta"
                    [href]="offer.url"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <span class="ms-icon" aria-hidden="true">open_in_new</span>
                    Ver na loja
                  </a>
                </div>
              </article>
            }
          </div>
        }

        <app-pagination
          [page]="page()"
          [hasMore]="current.nextOffset !== null"
          (pageChange)="goToPage($event)"
        />
      }
    </div>
  `,
  styles: `
    .deals-title {
      margin-top: 10px;
    }

    .deal-search {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 10px;
    }

    .deal-search__input {
      position: relative;
      flex: 1 1 260px;

      .ms-icon {
        position: absolute;
        left: 13px;
        top: 50%;
        transform: translateY(-50%);
        color: var(--text-muted);
        font-size: 18px;
        pointer-events: none;
      }

      input {
        width: 100%;
        padding: 10px 14px 10px 38px;
        color: var(--text-primary);
        background: var(--bg-input);
        border: 1px solid var(--border-subtle);
        border-radius: var(--radius-md);
        font: inherit;
        outline: none;

        &:focus {
          border-color: var(--accent-cyan);
        }
      }
    }

    .deal-filters-row {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 12px;
    }

    .deal-popular {
      position: relative;
      display: inline-flex;
      align-items: center;
      gap: 12px;
      padding: 9px 14px;
      border-radius: 999px;
      border: 1px solid var(--border-subtle);
      background: var(--bg-surface);
      color: var(--text-secondary);
      cursor: pointer;
      user-select: none;
      transition: border-color 0.15s ease, background-color 0.15s ease, color 0.15s ease;

      &:hover:not(.is-disabled) {
        border-color: var(--border-strong);
        color: var(--text-primary);
      }

      &:has(:focus-visible) {
        outline: 2px solid var(--accent-primary);
        outline-offset: 2px;
      }

      &.is-active {
        background: var(--accent-soft);
        border-color: var(--border-glow);
        color: var(--text-primary);

        .deal-popular__icon {
          color: var(--accent-primary);
          font-variation-settings: 'FILL' 1, 'wght' 500, 'GRAD' 0, 'opsz' 24;
        }

        .deal-popular__switch {
          background: var(--accent-primary);
          border-color: var(--accent-primary);

          &::after {
            transform: translateX(16px);
            background: #101113;
          }
        }
      }

      &.is-disabled {
        opacity: 0.55;
        cursor: not-allowed;
      }
    }

    .deal-popular__input {
      position: absolute;
      opacity: 0;
      width: 1px;
      height: 1px;
      pointer-events: none;
    }

    .deal-popular__icon {
      font-size: 19px;
      color: var(--text-muted);
    }

    .deal-popular__text {
      display: inline-flex;
      align-items: baseline;
      flex-wrap: wrap;
      gap: 6px;
      font-size: 0.86rem;

      strong {
        font-weight: 600;
      }

      small {
        color: var(--text-muted);
        font-size: 0.78rem;
      }
    }

    .deal-popular__switch {
      position: relative;
      width: 36px;
      height: 20px;
      border-radius: 999px;
      background: var(--bg-rail);
      border: 1px solid var(--border-strong);
      flex-shrink: 0;
      transition: background-color 0.16s ease, border-color 0.16s ease;

      &::after {
        content: '';
        position: absolute;
        top: 2px;
        left: 2px;
        width: 14px;
        height: 14px;
        border-radius: 50%;
        background: var(--text-secondary);
        transition: transform 0.16s ease, background-color 0.16s ease;
      }
    }
    .deal-shop {
      min-width: 180px;
    }

    .error-box {
      display: flex;
      flex-direction: column;
      gap: 14px;
    }

    .prices {
      display: flex;
      align-items: baseline;
      flex-wrap: wrap;
      gap: 8px;
      margin-top: auto;
      font-variant-numeric: tabular-nums;

      del {
        color: var(--text-muted);
        font-size: 0.84rem;
      }

      strong {
        font-size: 1.12rem;
        color: var(--accent-primary);
      }
    }

    .deal-cta {
      width: 100%;
    }
  `,
})
export class DealsPageComponent implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly url = inject(API_BASE_URL) + '/deals';
  private readonly destroyRef = inject(DestroyRef);
  private readonly offsets = [0];

  protected readonly shopOptions = SHOP_OPTIONS;
  protected readonly skeletonItems = SKELETON_ITEMS;
  protected searchText = '';
  protected readonly query = signal('');
  protected readonly popular = signal(false);
  protected readonly shop = signal<DealShop>('');
  protected readonly sort = signal<DealSort>('discount');
  protected readonly page = signal(1);
  protected readonly loading = signal(false);
  protected readonly result = signal<DealsPage | null>(null);
  protected readonly error = signal('');

  ngOnInit(): void {
    this.load();
  }

  protected submitSearch(): void {
    if (this.loading()) return;
    this.query.set(this.searchText.trim());
    if (this.query()) this.popular.set(false);
    this.resetPage();
  }

  protected clearSearch(): void {
    this.searchText = '';
    this.submitSearch();
  }

  private resetPage(): void {
    this.offsets.length = 1;
    this.page.set(1);
    this.load();
  }

  protected changePopularity(popular: boolean): void {
    if (this.loading() || this.query() || popular === this.popular()) return;
    this.popular.set(popular);
    this.resetPage();
  }

  protected changeShop(shop: DealShop): void {
    if (this.loading() || shop === this.shop()) return;
    this.shop.set(shop);
    this.resetPage();
  }

  protected changeSort(sort: DealSort): void {
    if (this.loading() || sort === this.sort()) return;
    this.sort.set(sort);
    this.resetPage();
  }

  protected goToPage(page: number): void {
    if (this.loading() || page < 1 || page === this.page()) return;
    if (this.offsets[page - 1] === undefined) return;
    this.page.set(page);
    this.load();
  }

  protected load(): void {
    if (this.loading()) return;
    this.loading.set(true);
    this.error.set('');
    this.http
      .get<DealsPage>(this.url, {
        params: {
          offset: this.offsets[this.page() - 1],
          sort: this.sort(),
          q: this.query(),
          ...(this.shop() ? { shop: this.shop() } : {}),
        ...(this.popular() ? { popular: true } : {}),
        },
      })
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.loading.set(false)),
      )
      .subscribe({
        next: (result) => {
          this.offsets.length = this.page();
          if (result.nextOffset !== null) this.offsets.push(result.nextOffset);
          this.result.set(result);
        },
        error: (error) => this.error.set(parseApiError(error).message),
      });
  }
}
