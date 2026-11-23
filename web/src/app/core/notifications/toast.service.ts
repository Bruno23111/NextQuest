import { Injectable, signal, untracked } from '@angular/core';

export type ToastTone = 'error' | 'success' | 'info';

export interface ToastItem {
  id: number;
  message: string;
  tone: ToastTone;
}

@Injectable({ providedIn: 'root' })
export class ToastService {
  private nextId = 1;
  private readonly timers = new Map<number, ReturnType<typeof setTimeout>>();

  readonly toasts = signal<ToastItem[]>([]);

  show(message: string, tone: ToastTone = 'info', durationMs?: number): void {
    const text = message.trim();
    if (!text) return;

    const existing = untracked(() => this.toasts()).find(
      (t) => t.message === text && t.tone === tone,
    );
    const ttl = durationMs ?? (tone === 'error' ? 6000 : 4500);

    if (existing) {
      this.scheduleDismiss(existing.id, ttl);
      return;
    }

    const id = this.nextId++;
    this.toasts.update((list) => [...list, { id, message: text, tone }]);
    this.scheduleDismiss(id, ttl);
  }

  dismiss(id: number): void {
    const timer = this.timers.get(id);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(id);
    }
    this.toasts.update((list) => list.filter((t) => t.id !== id));
  }

  private scheduleDismiss(id: number, durationMs: number): void {
    const prev = this.timers.get(id);
    if (prev) clearTimeout(prev);
    const timer = setTimeout(() => this.dismiss(id), durationMs);
    this.timers.set(id, timer);
  }
}
