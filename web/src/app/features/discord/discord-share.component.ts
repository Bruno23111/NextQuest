import { Component, DestroyRef, ElementRef, inject, input, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { parseApiError } from '../../core/errors/problem-details';
import { DiscordApi, DiscordShareTarget } from './discord.api';

@Component({
  selector: 'app-discord-share',
  imports: [RouterLink],
  template: `
    <button type="button" class="nq-btn nq-btn--secondary" (click)="open()">
      Compartilhar no Discord
    </button>
    <dialog #preview aria-label="Prévia da publicação no Discord" (cancel)="cancel($event)">
      <h2>Publicar no Discord</h2>
      @if (image(); as url) {
        <img [src]="url" alt="" loading="lazy" />
      }
      <p><strong>{{ title() }}</strong></p>
      <p>{{ description() }}</p>
      @if (error()) {
        <p role="alert">{{ error() }}</p>
        @if (needsSetup()) {
          <a routerLink="/profile">Configurar no perfil</a>
        }
      }
      @if (sent()) { <p role="status">Publicado no Discord.</p> }
      <div class="actions">
        <button type="button" class="nq-btn nq-btn--ghost" [disabled]="sending()" (click)="preview.close()">
          {{ sent() ? 'Fechar' : 'Cancelar' }}
        </button>
        @if (!sent()) {
          <button type="button" class="nq-btn nq-btn--primary" [disabled]="sending()" (click)="send()">
            {{ sending() ? 'Publicando…' : 'Confirmar envio' }}
          </button>
        }
      </div>
    </dialog>
  `,
  styles: `
    dialog {
      color: var(--text-primary);
      background: var(--bg-surface);
      border: 1px solid var(--border-subtle);
      border-radius: 12px;
      width: min(440px, calc(100% - 32px));
      padding: 20px;
    }
    dialog::backdrop { background: #000a; }
    img { max-width: 120px; max-height: 120px; object-fit: contain; }
    .actions { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 16px; }
  `,
})
export class DiscordShareComponent {
  readonly target = input.required<DiscordShareTarget>();
  readonly title = input.required<string>();
  readonly description = input.required<string>();
  readonly image = input<string | null>();
  private readonly preview = viewChild.required<ElementRef<HTMLDialogElement>>('preview');
  private readonly api = inject(DiscordApi);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly sending = signal(false);
  protected readonly sent = signal(false);
  protected readonly error = signal('');
  protected readonly needsSetup = signal(false);

  protected open(): void {
    this.sent.set(false);
    this.error.set('');
    this.needsSetup.set(false);
    this.preview().nativeElement.showModal();
  }

  protected cancel(event: Event): void {
    if (this.sending()) event.preventDefault();
  }

  protected send(): void {
    if (this.sending() || this.sent()) return;
    this.sending.set(true);
    this.error.set('');
    this.needsSetup.set(false);
    this.api.share(this.target()).pipe(
      takeUntilDestroyed(this.destroyRef),
      finalize(() => this.sending.set(false)),
    ).subscribe({
      next: () => this.sent.set(true),
      error: error => {
        const problem = parseApiError(error);
        this.error.set(problem.message);
        this.needsSetup.set(problem.status === 409 && problem.message.includes('Configure um canal'));
      },
    });
  }
}
