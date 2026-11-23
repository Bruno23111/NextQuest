import { Component, DestroyRef, effect, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { parseApiError } from '../../../core/errors/problem-details';
import { FeedbackBannerComponent } from '../../../shared/components/feedback-banner.component';
import { GameJournal, PlayPlanApi } from '../services/play-plan.api';

@Component({
  selector: 'app-game-journal',
  standalone: true,
  imports: [FormsModule, FeedbackBannerComponent],
  template: `
    <section class="nq-card journal-card">
      <h2>Diário de progresso</h2>
      <app-feedback-banner [message]="error()" tone="error" />
      @if (saved()) {
        <app-feedback-banner message="Diário salvo." tone="success" />
      }
      @if (journal(); as draft) {
        <form (ngSubmit)="save(draft)">
          <fieldset [disabled]="busy()">
            <label class="nq-field">Onde parei
              <textarea name="checkpoint" [(ngModel)]="draft.lastCheckpoint" maxlength="500"></textarea>
            </label>
            <label class="nq-field">Próximo objetivo
              <textarea name="objective" [(ngModel)]="draft.nextObjective" maxlength="500"></textarea>
            </label>
            <label class="nq-field">Notas
              <textarea name="notes" [(ngModel)]="draft.notes" maxlength="2000" rows="4"></textarea>
            </label>
            <div>
              <button type="submit" class="nq-btn nq-btn--primary">
                <span class="ms-icon" aria-hidden="true">save</span>
                Salvar diário
              </button>
            </div>
          </fieldset>
        </form>
      } @else if (busy()) {
        <p class="journal-muted">Carregando diário…</p>
      } @else {
        <button type="button" class="nq-btn nq-btn--secondary" (click)="reload()">Tentar novamente</button>
      }
    </section>
  `,
  styles: `
    .journal-card { display: flex; flex-direction: column; gap: 14px; }
    .journal-card h2 { margin: 0; font-size: 1.15rem; }
    .journal-muted { margin: 0; color: var(--text-muted); font-size: 0.88rem; }
    fieldset { border: 0; margin: 0; padding: 0; display: grid; gap: 12px; }
  `,
})
export class GameJournalComponent {
  readonly gameId = input.required<string>();
  private readonly api = inject(PlayPlanApi);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly journal = signal<GameJournal | null>(null);
  protected readonly busy = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly saved = signal(false);
  protected readonly retry = signal(0);

  constructor() {
    effect(onCleanup => {
      const id = this.gameId();
      this.retry();
      this.journal.set(null);
      this.busy.set(true);
      this.error.set(null);
      this.saved.set(false);
      const subscription = this.api.journal(id).subscribe({
        next: journal => { this.journal.set(journal); this.busy.set(false); },
        error: error => this.fail(error),
      });
      onCleanup(() => subscription.unsubscribe());
    });
  }

  protected reload(): void { this.retry.update(value => value + 1); }

  protected save(journal: GameJournal): void {
    if (this.busy()) return;
    const id = this.gameId();
    this.busy.set(true);
    this.error.set(null);
    this.saved.set(false);
    this.api.saveJournal(id, journal).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        if (id !== this.gameId()) return;
        this.busy.set(false);
        this.saved.set(true);
      },
      error: error => { if (id === this.gameId()) this.fail(error); },
    });
  }

  private fail(error: unknown): void {
    this.error.set(parseApiError(error).message);
    this.busy.set(false);
  }
}
