import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs';
import { parseApiError } from '../../core/errors/problem-details';
import { ToastService } from '../../core/notifications/toast.service';
import { SocialApi } from './social.api';

@Injectable()
export class WishlistStore {
  private readonly api = inject(SocialApi);
  private readonly toast = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);
  readonly ids = signal<ReadonlySet<number>>(new Set());
  readonly pending = signal<ReadonlySet<number>>(new Set());
  readonly loading = signal(false);
  private ready = false;

  constructor() {
    this.load();
  }

  private load(): void {
    if (this.loading()) return;
    this.loading.set(true);
    this.api.wishIds().pipe(
      takeUntilDestroyed(this.destroyRef),
      finalize(() => this.loading.set(false)),
    ).subscribe({
      next: (ids) => {
        this.ids.set(new Set(ids));
        this.ready = true;
      },
      error: (error: unknown) => this.toast.show(parseApiError(error).message, 'error'),
    });
  }

  toggle(id: number): void {
    if (this.loading()) return;
    if (!this.ready) {
      this.load();
      return;
    }
    this.set(id, !this.ids().has(id));
  }

  set(id: number, enabled: boolean, saved?: () => void): void {
    if (this.loading() || this.pending().has(id)) return;
    this.pending.update((ids) => new Set(ids).add(id));
    this.api.setWish(id, enabled).pipe(
      takeUntilDestroyed(this.destroyRef),
      finalize(() => this.pending.update((ids) => this.withId(ids, id, false))),
    ).subscribe({
      next: () => {
        this.ids.update((ids) => this.withId(ids, id, enabled));
        this.toast.show(enabled ? 'Jogo salvo na lista de desejos.' : 'Jogo removido da lista de desejos.', 'success');
        saved?.();
      },
      error: (error: unknown) => this.toast.show(parseApiError(error).message, 'error'),
    });
  }

  private withId(source: ReadonlySet<number>, id: number, enabled: boolean): ReadonlySet<number> {
    const updated = new Set(source);
    if (enabled) updated.add(id);
    else updated.delete(id);
    return updated;
  }
}
