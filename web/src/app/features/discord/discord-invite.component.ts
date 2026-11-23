import { DatePipe } from '@angular/common';
import { Component, DestroyRef, ElementRef, inject, input, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { parseApiError } from '../../core/errors/problem-details';
import { DiscordApi } from './discord.api';

@Component({
  selector: 'app-discord-invite',
  imports: [DatePipe, FormsModule, RouterLink],
  template: `
    <button type="button" class="nq-btn nq-btn--secondary" (click)="open()">Bora jogar?</button>
    <dialog #dialog aria-labelledby="invite-title" (cancel)="cancel($event)">
      <h2 id="invite-title">Bora jogar?</h2>
      <form (ngSubmit)="send()">
        @if (!sent()) {
          <label class="nq-field">Data e hora no seu fuso
            <input type="datetime-local" name="startsAt" required [(ngModel)]="startsAt" [disabled]="sending()" />
          </label>
          <label class="nq-field">Mensagem opcional
            <textarea name="message" maxlength="300" rows="3" [(ngModel)]="message" [disabled]="sending()"></textarea>
          </label>
          <div class="nq-card preview">
            @if (cover(); as url) { <img [src]="url" alt="" /> }
            <div>
              <strong>Bora jogar? {{ title() }}</strong>
              <div>{{ platform() }}</div>
              @if (selectedDate(); as date) { <div>{{ date | date: 'dd/MM/yyyy HH:mm' }}</div> }
              @if (message.trim()) { <p>{{ message.trim() }}</p> }
            </div>
          </div>
        }
        @if (error()) {
          <p role="alert">{{ error() }}</p>
          @if (needsSetup()) { <a routerLink="/profile">Escolher canal no perfil</a> }
        }
        @if (sent()) { <p role="status">Convite publicado no Discord.</p> }
        <div class="actions">
          <button type="button" class="nq-btn nq-btn--ghost" [disabled]="sending()" (click)="dialog.close()">
            {{ sent() ? 'Fechar' : 'Cancelar' }}
          </button>
          @if (!sent()) {
            <button type="submit" class="nq-btn nq-btn--primary" [disabled]="sending() || !selectedDate()">
              {{ sending() ? 'Publicando…' : 'Publicar convite' }}
            </button>
          }
        </div>
      </form>
    </dialog>
  `,
  styles: `
    dialog {
      box-sizing: border-box;
      width: min(480px, calc(100% - 32px));
      padding: 20px;
      color: var(--text-primary);
      background: var(--bg-surface);
      border: 1px solid var(--border-subtle);
      border-radius: 12px;
    }
    dialog::backdrop { background: #000a; }
    form { display: grid; gap: 12px; }
    .preview, .actions { display: flex; flex-wrap: wrap; gap: 8px; }
    .preview { overflow-wrap: anywhere; }
    .preview img { width: 64px; height: 74px; object-fit: cover; border-radius: 6px; }
  `,
})
export class DiscordInviteComponent {
  readonly gameId = input.required<string>();
  readonly title = input.required<string>();
  readonly platform = input.required<string>();
  readonly cover = input<string | null>();
  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');
  private readonly api = inject(DiscordApi);
  private readonly destroyRef = inject(DestroyRef);

  protected startsAt = '';
  protected message = '';
  protected readonly sending = signal(false);
  protected readonly sent = signal(false);
  protected readonly error = signal('');
  protected readonly needsSetup = signal(false);

  protected open(): void {
    this.sent.set(false);
    this.error.set('');
    this.needsSetup.set(false);
    this.dialog().nativeElement.showModal();
  }

  protected cancel(event: Event): void {
    if (this.sending()) event.preventDefault();
  }

  protected selectedDate(): Date | null {
    const date = new Date(this.startsAt);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  protected send(): void {
    if (this.sending() || this.sent()) return;

    const date = this.selectedDate();
    this.needsSetup.set(false);
    if (!date || date.getTime() <= Date.now()) {
      this.error.set('Escolha uma data e um horário no futuro.');
      return;
    }

    this.sending.set(true);
    this.error.set('');
    this.api.invite(this.gameId(), date.toISOString(), this.message.trim() || undefined).pipe(
      takeUntilDestroyed(this.destroyRef),
      finalize(() => this.sending.set(false)),
    ).subscribe({
      next: () => {
        this.sent.set(true);
        this.startsAt = '';
        this.message = '';
      },
      error: error => {
        const problem = parseApiError(error);
        this.error.set(problem.message);
        this.needsSetup.set(problem.status === 409);
      },
    });
  }
}
