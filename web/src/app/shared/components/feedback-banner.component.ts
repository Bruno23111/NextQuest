import { Component, computed, input } from '@angular/core';

const TONE_ICONS: Record<'error' | 'success' | 'info', string> = {
  error: 'error_outline',
  success: 'check_circle',
  info: 'info',
};

@Component({
  selector: 'app-feedback-banner',
  standalone: true,
  template: `
    @if (message()) {
      <div class="banner" [class]="'banner banner--' + tone()" role="alert">
        <span class="ms-icon" aria-hidden="true">{{ icon() }}</span>
        <span>{{ message() }}</span>
      </div>
    }
  `,
  styles: `
    .banner {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 12px 16px;
      border-radius: var(--radius-md);
      font-size: 0.9rem;
      font-weight: 500;
      border: 1px solid;
    }

    .banner--error {
      background: color-mix(in srgb, var(--color-error) 12%, var(--bg-rail));
      border-color: color-mix(in srgb, var(--color-error) 40%, transparent);
      color: var(--color-error);
    }

    .banner--success {
      background: color-mix(in srgb, var(--color-success) 12%, var(--bg-rail));
      border-color: color-mix(in srgb, var(--color-success) 40%, transparent);
      color: var(--color-success);
    }

    .banner--info {
      background: color-mix(in srgb, var(--accent-cyan) 12%, var(--bg-rail));
      border-color: color-mix(in srgb, var(--accent-cyan) 40%, transparent);
      color: var(--accent-cyan);
    }
  `,
})
export class FeedbackBannerComponent {
  readonly message = input<string | null>(null);
  readonly tone = input<'error' | 'success' | 'info'>('error');
  protected readonly icon = computed(() => TONE_ICONS[this.tone()]);
}
