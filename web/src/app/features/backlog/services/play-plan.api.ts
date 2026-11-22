import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { API_BASE_URL } from '../../../core/config/api.config';

export interface QueuedGame {
  id: string;
  title: string;
}

export interface GameJournal {
  lastCheckpoint: string | null;
  nextObjective: string | null;
  notes: string | null;
}

@Injectable({ providedIn: 'root' })
export class PlayPlanApi {
  private readonly http = inject(HttpClient);
  private readonly backlog = inject(API_BASE_URL) + '/backlog';

  queue() {
    return this.http.get<QueuedGame[]>(this.backlog + '/queue');
  }

  saveQueue(games: QueuedGame[]) {
    return this.http.put<void>(this.backlog + '/queue', { gameIds: games.map(game => game.id) });
  }

  journal(id: string) {
    return this.http.get<GameJournal>(this.backlog + '/' + id + '/journal');
  }

  saveJournal(id: string, journal: GameJournal) {
    return this.http.put<void>(this.backlog + '/' + id + '/journal', journal);
  }
}
