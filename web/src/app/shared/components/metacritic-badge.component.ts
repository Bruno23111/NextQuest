import { Component, computed, input } from '@angular/core';

@Component({
  selector: 'app-metacritic-badge',
  standalone: true,
  template: `
    <span
      class="metascore"
      [class.is-good]="tier() === 'good'"
      [class.is-mixed]="tier() === 'mixed'"
      [class.is-bad]="tier() === 'bad'"
      [title]="'Metascore ' + score() + '/100'"
      [attr.aria-label]="'Metacritic ' + score() + ' de 100'"
    >
      {{ score() }}
    </span>
  `,
  styles: `
    .metascore {
      width: 38px;
      height: 38px;
      border-radius: 8px;
      display: inline-grid;
      place-items: center;
      font-weight: 800;
      font-size: 1rem;
      line-height: 1;
      color: #101113;
      font-variant-numeric: tabular-nums;
      flex-shrink: 0;
    }

    .is-good {
      background: #00ce7a;
    }

    .is-mixed {
      background: #ffbd3f;
    }

    .is-bad {
      background: #ff6874;
    }
  `,
})
export class MetacriticBadgeComponent {
  readonly score = input.required<number>();

  protected readonly tier = computed(() => {
    const value = this.score();
    if (value >= 75) return 'good';
    if (value >= 50) return 'mixed';
    return 'bad';
  });
}
