import { Component, computed, inject, input } from '@angular/core';
import { WishlistStore } from './wishlist.store';

@Component({
  selector: 'app-wishlist-button',
  template: `
    <button type="button" class="nq-btn nq-btn--secondary" [attr.aria-pressed]="saved()"
      [disabled]="store.loading() || store.pending().has(gameId())" (click)="store.toggle(gameId())">
      <span class="ms-icon" aria-hidden="true">favorite</span>
      {{ saved() ? 'Na lista de desejos' : 'Adicionar aos desejos' }}
    </button>
  `,
})
export class WishlistButtonComponent {
  readonly gameId = input.required<number>();
  protected readonly store = inject(WishlistStore);
  protected readonly saved = computed(() => this.store.ids().has(this.gameId()));
}
