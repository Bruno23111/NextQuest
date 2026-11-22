import { Component, OnInit, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { parseApiError } from '../../../core/errors/problem-details';
import { PlayPlanApi, QueuedGame } from '../services/play-plan.api';

@Component({
  selector: 'app-play-queue',
  imports: [RouterLink],
  template: `
    <section class="nq-card">
      <h2>Próximos jogos</h2>
      @if (error()) { <p role="alert">{{ error() }}</p> }
      @if (games(); as queue) {
        @if (queue.length === 0) {
          <p>Abra um jogo do backlog para adicioná-lo à fila.</p>
        } @else {
          <ol>
            @for (game of queue; track game.id; let index = $index) {
              <li>
                <a [routerLink]="['/backlog', game.id]">{{ game.title }}</a>
                <div class="actions">
                  <button type="button" class="nq-btn nq-btn--ghost" [disabled]="busy() || index === 0"
                    [attr.aria-label]="'Subir ' + game.title" (click)="move(index, -1)">↑</button>
                  <button type="button" class="nq-btn nq-btn--ghost" [disabled]="busy() || index === queue.length - 1"
                    [attr.aria-label]="'Descer ' + game.title" (click)="move(index, 1)">↓</button>
                  <button type="button" class="nq-btn nq-btn--ghost" [disabled]="busy()"
                    (click)="remove(game.id)">Remover</button>
                </div>
              </li>
            }
          </ol>
        }
        @if (candidate(); as game) {
          @if (!contains(game.id)) {
            <button type="button" class="nq-btn nq-btn--secondary" [disabled]="busy() || queue.length >= 5"
              (click)="save([...queue, game])">Adicionar à fila</button>
          }
        }
        @if (queue.length === 5) { <p>Fila completa · 5 jogos</p> }
      } @else if (busy()) {
        <p>Carregando fila…</p>
      } @else {
        <button type="button" class="nq-btn nq-btn--secondary" (click)="load()">Tentar novamente</button>
      }
    </section>
  `,
  styles: `
    li { padding-block: 6px; }
    .actions { display: inline-flex; flex-wrap: wrap; gap: 4px; margin-inline-start: 8px; }
  `,
})
export class PlayQueueComponent implements OnInit {
  readonly candidate = input<QueuedGame>();
  private readonly api = inject(PlayPlanApi);
  protected readonly games = signal<QueuedGame[] | null>(null);
  protected readonly busy = signal(true);
  protected readonly error = signal<string | null>(null);

  ngOnInit(): void { this.load(); }

  protected load(): void {
    this.busy.set(true);
    this.error.set(null);
    this.api.queue().subscribe({
      next: games => { this.games.set(games); this.busy.set(false); },
      error: error => this.fail(error),
    });
  }

  protected contains(id: string): boolean {
    return this.games()?.some(game => game.id === id) ?? false;
  }

  protected remove(id: string): void {
    this.save((this.games() ?? []).filter(game => game.id !== id));
  }

  protected move(index: number, offset: number): void {
    const games = [...(this.games() ?? [])];
    const target = index + offset;
    if (index < 0 || index >= games.length || target < 0 || target >= games.length) return;
    const [game] = games.splice(index, 1);
    games.splice(target, 0, game);
    this.save(games);
  }

  protected save(games: QueuedGame[]): void {
    if (this.busy()) return;
    this.busy.set(true);
    this.error.set(null);
    this.api.saveQueue(games).subscribe({
      next: () => { this.games.set(games); this.busy.set(false); },
      error: error => this.fail(error),
    });
  }

  private fail(error: unknown): void {
    this.error.set(parseApiError(error).message);
    this.busy.set(false);
  }
}
