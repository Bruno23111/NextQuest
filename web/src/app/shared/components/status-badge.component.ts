import { Component, computed, input } from '@angular/core';
import { GameStatus } from '../../core/models/api.models';

const STATUS_META: Record<GameStatus, { label: string; colorVar: string; icon: string }> = {
  planned: { label: 'Planejado', colorVar: 'var(--status-planned)', icon: 'bookmark_border' },
  playing: { label: 'Jogando', colorVar: 'var(--status-playing)', icon: 'play_arrow' },
  completed: { label: 'Zerado', colorVar: 'var(--status-completed)', icon: 'check_circle' },
  dropped: { label: 'Abandonado', colorVar: 'var(--status-dropped)', icon: 'cancel' },
};

@Component({
  selector: 'app-status-badge',
  standalone: true,
  template: `
    <span class="status-pill" [style.--dot-color]="meta().colorVar">
      <span class="ms-icon status-pill__icon" aria-hidden="true">{{ meta().icon }}</span>
      {{ meta().label }}
    </span>
  `,
  styles: `
    .status-pill {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      padding: 4px 10px;
      border-radius: 999px;
      font-size: 0.75rem;
      font-weight: 600;
      background: rgba(16, 17, 19, 0.84);
      border: 1px solid color-mix(in srgb, var(--dot-color) 48%, transparent);
      color: var(--dot-color);
      backdrop-filter: blur(8px);
    }

    .status-pill__icon {
      font-size: 15px;
      color: var(--dot-color);
    }
  `,
})
export class StatusBadgeComponent {
  readonly status = input.required<GameStatus>();
  protected readonly meta = computed(() => STATUS_META[this.status()] ?? STATUS_META.planned);
}
