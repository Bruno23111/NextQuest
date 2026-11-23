import { HttpClient } from '@angular/common/http';
import { Component, DestroyRef, computed, inject, input, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { finalize } from 'rxjs';
import { API_BASE_URL } from '../../core/config/api.config';
import { parseApiError } from '../../core/errors/problem-details';
import { FeedbackBannerComponent } from '../../shared/components/feedback-banner.component';
import { SelectComponent, SelectOption } from '../../shared/components/select.component';

interface BatchResult {
  requested: number;
  found: number;
  added: number;
  skipped: number;
}

interface CatalogPreview {
  previewId: string;
  items: { rawgId: number; title: string }[];
  publishedIds: number[];
}

interface CatalogPublish {
  added: number;
  marked: number;
  catalogIds: number[];
}

const LIST_OPTIONS: readonly SelectOption<'popular' | 'new'>[] = [
  { value: 'popular', label: 'Populares' },
  { value: 'new', label: 'Novidades' },
];

const BATCH_SIZE_OPTIONS: readonly SelectOption<number>[] = [
  { value: 10, label: '10 títulos' },
  { value: 50, label: '50 títulos' },
  { value: 100, label: '100 títulos' },
  { value: 200, label: '200 títulos' },
  { value: 500, label: '500 títulos' },
];

@Component({
  selector: 'app-popular-batch',
  standalone: true,
  imports: [FormsModule, FeedbackBannerComponent, SelectComponent],
  template: `
    <section class="nq-card batch-card">
      <div class="batch-card__header">
        <div class="batch-card__title-group">
          <div class="batch-card__icon" aria-hidden="true">
            <span class="ms-icon">bolt</span>
          </div>
          <div>
            <h2>{{ source() === 'catalog' ? 'Adicionar jogos em lote' : 'Adicionar populares em lote' }}</h2>
            <p>
              {{
                source() === 'catalog'
                  ? 'Confira a lista antes de publicar ou marcar jogos que já estão no catálogo.'
                  : 'Publique ofertas dos jogos mais populares.'
              }}
            </p>
          </div>
        </div>

        <form class="batch-card__form" (ngSubmit)="run()">
          @if (source() === 'catalog') {
            <div class="batch-card__select batch-card__select--list">
              <app-select
                [options]="listOptions"
                [value]="list()"
                [disabled]="busy()"
                ariaLabel="Lista de jogos"
                (valueChange)="list.set($event); clearPreview()"
              />
            </div>
          }
          <div class="batch-card__select">
            <app-select
              [options]="sizeOptions"
              [value]="count()"
              [disabled]="busy()"
              ariaLabel="Quantidade de títulos para importar"
              (valueChange)="count.set($event); clearPreview()"
            />
          </div>
          <button type="submit" class="nq-btn nq-btn--secondary" [disabled]="busy()">
            <span class="ms-icon" aria-hidden="true">{{ source() === 'catalog' ? 'visibility' : 'download' }}</span>
            {{ source() === 'catalog' ? 'Ver prévia' : 'Adicionar em lote' }}
          </button>
        </form>
      </div>

      <app-feedback-banner [message]="error()" tone="error" [inline]="true" />

      @if (busy()) {
        <div class="batch-status" role="status">
          <span class="ms-icon batch-status__icon" aria-hidden="true">hourglass_top</span>
          <span>Processando lote…</span>
        </div>
      }

      @if (preview(); as current) {
        <div class="batch-preview-box">
          <div class="batch-preview__toolbar">
            <div class="batch-preview__counts">
              <span class="nq-chip">{{ current.items.length }} encontrados</span>
              <span class="nq-chip nq-chip--accent">{{ selected().size }} selecionados</span>
            </div>

            <div class="batch-preview__actions">
              <button
                type="button"
                class="nq-btn nq-btn--secondary batch-preview__btn"
                [disabled]="busy() || !current.items.length"
                (click)="selectMissing(current)"
              >
                <span class="ms-icon" aria-hidden="true">done_all</span>
                Selecionar novos
              </button>
              <button
                type="button"
                class="nq-btn nq-btn--ghost batch-preview__btn"
                [disabled]="busy() || !selected().size"
                (click)="selected.set(emptySelection)"
              >
                <span class="ms-icon" aria-hidden="true">close</span>
                Limpar seleção
              </button>
            </div>
          </div>

          <ul class="batch-preview__list">
            @for (game of current.items; track game.rawgId) {
              <li>
                <label class="batch-preview__item" [class.is-selected]="selected().has(game.rawgId)">
                  <input
                    type="checkbox"
                    [checked]="selected().has(game.rawgId)"
                    [disabled]="busy()"
                    (change)="toggle(game.rawgId, $any($event.target).checked)"
                  />
                  <span class="batch-preview__title">{{ game.title }}</span>
                  @if (published().has(game.rawgId)) {
                    <span class="nq-chip batch-preview__tag">Já no catálogo · marcar</span>
                  }
                </label>
              </li>
            } @empty {
              <li class="batch-preview__empty">Nenhum jogo encontrado.</li>
            }
          </ul>

          <div class="batch-preview__footer">
            <button
              type="button"
              class="nq-btn nq-btn--primary"
              [disabled]="busy() || !selected().size"
              (click)="publish(current)"
            >
              <span class="ms-icon" aria-hidden="true">check</span>
              Confirmar selecionados ({{ selected().size }})
            </button>
          </div>
        </div>
      }

      @if (confirmation(); as summary) {
        <div class="batch-card__summary" role="status">
          <span class="nq-chip batch-chip batch-chip--success">
            <span class="ms-icon" aria-hidden="true">check_circle</span>
            Adicionados: {{ summary.added }}
          </span>
          <span class="nq-chip batch-chip">
            <span class="ms-icon" aria-hidden="true">bookmark_added</span>
            Existentes marcados: {{ summary.marked }}
          </span>
        </div>
      }

      @if (result(); as summary) {
        <div class="batch-card__summary" role="status">
          <span class="nq-chip batch-chip batch-chip--success">
            <span class="ms-icon" aria-hidden="true">check_circle</span>
            Adicionados: {{ summary.added }}
          </span>
          <span class="nq-chip batch-chip">
            <span class="ms-icon" aria-hidden="true">layers</span>
            Já existentes: {{ summary.skipped }}
          </span>
          @if (summary.found < summary.requested) {
            <span class="nq-chip batch-chip batch-chip--warn">
              <span class="ms-icon" aria-hidden="true">info</span>
              Disponíveis: {{ summary.found }} de {{ summary.requested }}
            </span>
          }
        </div>
      }
    </section>
  `,
  styles: `
    .batch-card {
      display: flex;
      flex-direction: column;
      gap: 14px;
    }

    .batch-card__header {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
    }

    .batch-card__title-group {
      display: flex;
      align-items: center;
      gap: 14px;
      min-width: 0;

      h2 {
        margin: 0 0 3px;
        font-size: 1.05rem;
        font-weight: 700;
      }

      p {
        margin: 0;
        font-size: 0.85rem;
        color: var(--text-muted);
      }
    }

    .batch-card__icon {
      width: 40px;
      height: 40px;
      border-radius: 12px;
      display: grid;
      place-items: center;
      flex-shrink: 0;
      background: var(--accent-soft);
      color: var(--accent-primary);
      border: 1px solid var(--border-glow);
    }

    .batch-card__form {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 10px;
    }

    .batch-card__select {
      width: 150px;
    }

    .batch-card__select--list {
      width: 140px;
    }

    .batch-status {
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
      font-weight: 500;
    }

    .batch-status__icon {
      font-size: 18px;
      color: var(--accent-cyan);
    }

    .batch-preview-box {
      display: flex;
      flex-direction: column;
      gap: 12px;
      padding-top: 14px;
      border-top: 1px solid var(--border-subtle);
    }

    .batch-preview__toolbar {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
    }

    .batch-preview__counts,
    .batch-preview__actions {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px;
    }

    .batch-preview__btn {
      padding: 7px 14px;
      font-size: 0.82rem;

      .ms-icon {
        font-size: 16px;
      }
    }

    .batch-preview__list {
      max-height: 22rem;
      overflow-y: auto;
      margin: 0;
      padding: 6px;
      list-style: none;
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
      gap: 8px;
      border-radius: var(--radius-md);
      background: var(--bg-rail);
      border: 1px solid var(--border-subtle);
    }

    .batch-preview__item {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 10px 12px;
      border-radius: var(--radius-sm);
      border: 1px solid transparent;
      background: var(--bg-surface);
      cursor: pointer;
      transition: background-color 0.14s ease, border-color 0.14s ease;

      &:hover {
        background: var(--bg-surface-hover);
        border-color: var(--border-strong);
      }

      &.is-selected {
        background: color-mix(in srgb, var(--accent-primary) 10%, var(--bg-surface));
        border-color: var(--border-glow);
      }

      input[type='checkbox'] {
        width: 16px;
        height: 16px;
        margin: 0;
        flex-shrink: 0;
        accent-color: var(--accent-primary);
        cursor: pointer;
      }
    }

    .batch-preview__title {
      flex: 1;
      min-width: 0;
      font-size: 0.88rem;
      font-weight: 500;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .batch-preview__tag {
      flex-shrink: 0;
      font-size: 0.7rem;
      padding: 2px 8px;
      color: var(--text-muted);
    }

    .batch-preview__empty {
      grid-column: 1 / -1;
      padding: 20px;
      text-align: center;
      color: var(--text-muted);
      font-size: 0.9rem;
    }

    .batch-preview__footer {
      display: flex;
      justify-content: flex-end;
    }

    .batch-card__summary {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px;
      padding-top: 8px;
      border-top: 1px solid var(--border-subtle);
    }

    .batch-chip {
      padding: 5px 12px;
      font-size: 0.8rem;

      .ms-icon {
        font-size: 15px;
      }
    }

    .batch-chip--success {
      color: var(--color-success);
      border-color: color-mix(in srgb, var(--color-success) 40%, transparent);
      background: color-mix(in srgb, var(--color-success) 10%, var(--bg-rail));
    }

    .batch-chip--warn {
      color: var(--color-warning);
      border-color: color-mix(in srgb, var(--color-warning) 40%, transparent);
      background: color-mix(in srgb, var(--color-warning) 10%, var(--bg-rail));
    }

    @media (max-width: 540px) {
      .batch-card__form {
        width: 100%;
      }

      .batch-card__select {
        flex: 1;
        min-width: 120px;
      }

      .batch-preview__footer button {
        width: 100%;
      }
    }
  `,
})
export class PopularBatchComponent {
  readonly source = input.required<'catalog' | 'deals'>();
  readonly catalogPublished = output<number[]>();
  private readonly http = inject(HttpClient);
  private readonly base = inject(API_BASE_URL);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly listOptions = LIST_OPTIONS;
  protected readonly sizeOptions = BATCH_SIZE_OPTIONS;
  protected readonly count = signal(10);
  protected readonly busy = signal(false);
  protected readonly error = signal('');
  protected readonly result = signal<BatchResult | null>(null);
  protected readonly list = signal<'popular' | 'new'>('popular');
  protected readonly preview = signal<CatalogPreview | null>(null);
  protected readonly emptySelection: ReadonlySet<number> = new Set();
  protected readonly selected = signal(this.emptySelection);
  protected readonly published = computed(() => new Set(this.preview()?.publishedIds));
  protected readonly confirmation = signal<CatalogPublish | null>(null);

  protected clearPreview(): void {
    this.preview.set(null);
    this.selected.set(this.emptySelection);
    this.confirmation.set(null);
  }

  protected toggle(id: number, checked: boolean): void {
    const updated = new Set(this.selected());
    if (checked) updated.add(id);
    else updated.delete(id);
    this.selected.set(updated);
  }

  protected selectMissing(preview: CatalogPreview): void {
    this.selected.set(
      new Set(
        preview.items
          .filter((game) => !this.published().has(game.rawgId))
          .map((game) => game.rawgId),
      ),
    );
  }

  protected publish(preview: CatalogPreview): void {
    if (this.busy() || !this.selected().size) return;
    this.busy.set(true);
    this.error.set('');
    this.http
      .post<CatalogPublish>(`${this.base}/admin/catalog/batch/${preview.previewId}/publish`, {
        ids: [...this.selected()],
      })
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.busy.set(false)),
      )
      .subscribe({
        next: (result) => {
          this.clearPreview();
          this.confirmation.set(result);
          this.catalogPublished.emit(result.catalogIds);
        },
        error: (error: unknown) => this.error.set(parseApiError(error).message),
      });
  }

  protected run(): void {
    if (this.busy()) return;
    this.busy.set(true);
    this.error.set('');
    this.result.set(null);
    this.clearPreview();
    if (this.source() === 'catalog') {
      this.http
        .post<CatalogPreview>(`${this.base}/admin/catalog/batch/preview`, {
          count: this.count(),
          list: this.list(),
        })
        .pipe(
          takeUntilDestroyed(this.destroyRef),
          finalize(() => this.busy.set(false)),
        )
        .subscribe({
          next: (preview) => this.preview.set(preview),
          error: (error: unknown) => this.error.set(parseApiError(error).message),
        });
      return;
    }
    this.http
      .post<BatchResult>(`${this.base}/admin/${this.source()}/popular/import`, {
        count: this.count(),
      })
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.busy.set(false)),
      )
      .subscribe({
        next: (result) => this.result.set(result),
        error: (error: unknown) => this.error.set(parseApiError(error).message),
      });
  }
}
