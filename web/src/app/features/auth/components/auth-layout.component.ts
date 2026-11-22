import { Component, input } from '@angular/core';

@Component({
  selector: 'app-auth-layout',
  standalone: true,
  template: `
    <div class="auth-stage">
      <div class="auth-card">
        <div class="auth-card__brand">
          <img class="auth-logo" src="nextquest.png" alt="NextQuest" width="44" height="44" />
          <div>
            <h1>{{ title() }}</h1>
            <p>{{ subtitle() }}</p>
          </div>
        </div>
        <ng-content />
      </div>
    </div>
  `,
  styles: `
    .auth-stage {
      min-height: 100vh;
      display: grid;
      place-items: center;
      padding: 24px 16px;
      background:
        radial-gradient(circle at 20% 15%, rgba(11, 105, 122, 0.26), transparent 44%),
        radial-gradient(circle at 80% 85%, rgba(181, 227, 76, 0.1), transparent 45%),
        var(--bg-canvas);
    }

    .auth-card {
      width: 100%;
      max-width: 440px;
      padding: 30px;
      border-radius: var(--radius-xl);
      background: var(--bg-glass);
      backdrop-filter: blur(18px);
      border: 1px solid var(--border-strong);
      box-shadow: var(--shadow-card);
      display: flex;
      flex-direction: column;
      gap: 20px;
    }

    .auth-card__brand {
      display: flex;
      align-items: center;
      gap: 14px;

      h1 {
        margin: 0 0 4px;
        font-size: 1.35rem;
      }

      p {
        margin: 0;
        font-size: 0.88rem;
        color: var(--text-secondary);
      }
    }

    .auth-logo {
      width: 44px;
      height: 44px;
      flex-shrink: 0;
      border-radius: 11px;
      object-fit: cover;
      display: block;
    }
  `,
})
export class AuthLayoutComponent {
  readonly title = input.required<string>();
  readonly subtitle = input.required<string>();
}
