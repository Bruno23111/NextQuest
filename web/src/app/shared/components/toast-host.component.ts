import { Component, inject } from '@angular/core';
import { ToastService, ToastTone } from '../../core/notifications/toast.service';

const TONE_ICONS: Record<ToastTone, string> = {
  error: 'error_outline',
  success: 'check_circle',
  info: 'info',
};

@Component({
  selector: 'app-toast-host',
  standalone: true,
  template: `
    <div class="toast-stack" aria-live="polite" aria-atomic="false">
      @for (toast of toastService.toasts(); track toast.id) {
        <div
          class="toast"
          [class]="'toast toast--' + toast.tone"
          [attr.role]="toast.tone === 'error' ? 'alert' : 'status'"
        >
          <span class="ms-icon toast__icon" aria-hidden="true">{{ iconFor(toast.tone) }}</span>
          <span class="toast__message">{{ toast.message }}</span>
          <button
            type="button"
            class="toast__close"
            aria-label="Fechar notificação"
            (click)="toastService.dismiss(toast.id)"
          >
            <span class="ms-icon" aria-hidden="true">close</span>
          </button>
        </div>
      }
    </div>
  `,
  styles: `
    .toast-stack {
      position: fixed;
      top: 20px;
      right: 24px;
      z-index: 9999;
      display: flex;
      flex-direction: column;
      gap: 10px;
      width: min(400px, calc(100vw - 32px));
      pointer-events: none;
    }

    .toast {
      pointer-events: auto;
      display: flex;
      align-items: flex-start;
      gap: 10px;
      padding: 13px 14px;
      border-radius: var(--radius-md);
      background: rgba(37, 40, 43, 0.96);
      backdrop-filter: blur(14px);
      border: 1px solid var(--border-subtle);
      box-shadow: 0 16px 40px rgba(0, 0, 0, 0.55);
      color: var(--text-primary);
      font-size: 0.9rem;
      line-height: 1.4;
      animation: toast-in 0.2s ease-out;
    }

    .toast--error {
      border-color: color-mix(in srgb, var(--color-error) 55%, transparent);

      .toast__icon {
        color: var(--color-error);
      }
    }

    .toast--success {
      border-color: color-mix(in srgb, var(--color-success) 55%, transparent);

      .toast__icon {
        color: var(--color-success);
      }
    }

    .toast--info {
      border-color: color-mix(in srgb, var(--accent-cyan) 55%, transparent);

      .toast__icon {
        color: var(--accent-cyan);
      }
    }

    .toast__icon {
      flex-shrink: 0;
      margin-top: 1px;
    }

    .toast__message {
      flex: 1;
      min-width: 0;
      overflow-wrap: anywhere;
    }

    .toast__close {
      flex-shrink: 0;
      display: inline-flex;
      padding: 2px;
      border: 0;
      border-radius: 50%;
      background: transparent;
      color: var(--text-muted);
      cursor: pointer;

      .ms-icon {
        font-size: 18px;
      }

      &:hover {
        color: var(--text-primary);
        background: var(--bg-surface-hover);
      }
    }

    @keyframes toast-in {
      from {
        opacity: 0;
        transform: translateY(-8px) scale(0.98);
      }
      to {
        opacity: 1;
        transform: translateY(0) scale(1);
      }
    }
  `,
})
export class ToastHostComponent {
  protected readonly toastService = inject(ToastService);

  protected iconFor(tone: ToastTone): string {
    return TONE_ICONS[tone];
  }
}
