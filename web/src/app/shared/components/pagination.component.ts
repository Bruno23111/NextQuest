import { Component, input, output } from '@angular/core';

@Component({
  selector: 'app-pagination',
  standalone: true,
  template: `
    @if (page() > 1 || hasMore()) {
      <nav aria-label="Paginação">
        <button
          type="button"
          class="nq-btn nq-btn--ghost"
          [disabled]="page() === 1"
          (click)="pageChange.emit(page() - 1)"
        >
          <span class="ms-icon" aria-hidden="true">chevron_left</span>
          Anterior
        </button>
        <span class="nq-chip page-indicator" aria-live="polite">
          Página {{ page() }}@if (totalPages(); as total) { de {{ total }} }
        </span>
        <button
          type="button"
          class="nq-btn nq-btn--ghost"
          [disabled]="!hasMore()"
          (click)="pageChange.emit(page() + 1)"
        >
          Próxima
          <span class="ms-icon" aria-hidden="true">chevron_right</span>
        </button>
      </nav>
    }
  `,
  styles: `
    nav {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: center;
      gap: 12px;
      margin-block: 16px;
    }

    .page-indicator {
      padding: 6px 14px;
      font-variant-numeric: tabular-nums;
    }
  `,
})
export class PaginationComponent {
  readonly page = input.required<number>();
  readonly hasMore = input.required<boolean>();
  readonly totalPages = input<number>();
  readonly pageChange = output<number>();
}
