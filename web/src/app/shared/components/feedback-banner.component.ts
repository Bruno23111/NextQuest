import { Component, computed, effect, inject, input, untracked } from '@angular/core';
import { ToastService, ToastTone } from '../../core/notifications/toast.service';

const TONE_ICONS: Record<ToastTone, string> = {
  error: 'error_outline',
  success: 'check_circle',
  info: 'info',
};

@Component({
  selector: 'app-feedback-banner',
  standalone: true,
  template: `
    @if (inline() && message()) {
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
  private readonly toast = inject(ToastService);

  readonly message = input<string | null>(null);
  readonly tone = input<ToastTone>('error');
  readonly inline = input<boolean>(false);

  protected readonly icon = computed(() => TONE_ICONS[this.tone()]);

  constructor() {
    effect(() => {
      const msg = this.message()?.trim();
      const tone = this.tone();
      if (msg && !this.inline()) {
        untracked(() => this.toast.show(msg, tone));
      }
    });
  }
}
