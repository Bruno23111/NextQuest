import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Observable, finalize, switchMap } from 'rxjs';
import { parseApiError } from '../../core/errors/problem-details';
import { FeedbackBannerComponent } from '../../shared/components/feedback-banner.component';
import { Friend, SocialApi } from './social.api';

@Component({
  standalone: true,
  imports: [FormsModule, RouterLink, FeedbackBannerComponent],
  template: `
    <main class="nq-page">
      <header class="nq-hero">
        <div>
          <span class="nq-spotlight__eyebrow">
            <span class="ms-icon" aria-hidden="true">group</span>
            Comunidade
          </span>
          <h1 class="friends-hero__title">Amigos</h1>
          <p>Veja o que seus amigos estão jogando e compartilhe sua biblioteca.</p>
        </div>

        <div class="friends-hero__stats">
          <span class="nq-chip">
            <span class="ms-icon chip-icon" aria-hidden="true">people</span>
            {{ friendCount() }} {{ friendCount() === 1 ? 'amigo' : 'amigos' }}
          </span>
          @if (incomingCount() > 0) {
            <span class="nq-chip nq-chip--accent">
              <span class="ms-icon chip-icon" aria-hidden="true">mark_email_unread</span>
              {{ incomingCount() }} {{ incomingCount() === 1 ? 'pedido recebido' : 'pedidos recebidos' }}
            </span>
          }
        </div>
      </header>

      <app-feedback-banner [message]="error()" tone="error" [inline]="true" />
      <app-feedback-banner [message]="status()" tone="success" />

      <section class="nq-card friends-connect">
        <div class="section-heading">
          <h2>
            <span class="ms-icon section-icon" aria-hidden="true">person_add</span>
            Adicionar amigo
          </h2>
        </div>

        <div class="friends-connect__grid">
          @if (ownCode(); as myCode) {
            <div class="nq-field">
              <label for="own-friend-code">Seu código de amizade</label>
              <div class="friends-connect__row">
                <input
                  id="own-friend-code"
                  class="code-input"
                  readonly
                  aria-label="Seu código de amizade"
                  [value]="myCode"
                />
                <button
                  type="button"
                  class="nq-btn nq-btn--secondary"
                  (click)="copy(myCode)"
                >
                  <span class="ms-icon" aria-hidden="true">content_copy</span>
                  Copiar código
                </button>
                <button type="button" class="nq-btn nq-btn--ghost" [disabled]="busy()" (click)="rotate()">
                  Gerar novo código
                </button>
              </div>
            </div>
          }

          <form class="nq-field" (ngSubmit)="send()">
            <label for="friend-code">Código do amigo</label>
            <div class="friends-connect__row">
              <input
                id="friend-code"
                maxlength="20"
                name="code"
                [(ngModel)]="code"
                autocomplete="off"
                placeholder="Cole o código de amizade"
                required
              />
              <button
                type="submit"
                class="nq-btn nq-btn--primary"
                [disabled]="busy() || !code.trim()"
              >
                <span class="ms-icon" aria-hidden="true">send</span>
                Enviar pedido
              </button>
            </div>
          </form>
        </div>
      </section>

      @for (group of groups(); track group.status) {
        <section class="nq-card friends-group">
          <div class="section-heading">
            <h2>
              <span class="ms-icon section-icon" aria-hidden="true">{{ group.icon }}</span>
              {{ group.title }}
            </h2>
            <span class="nq-chip">{{ group.items.length }}</span>
          </div>

          @if (group.items.length > 0) {
            <div class="friends-list">
              @for (person of group.items; track person.id) {
                <div class="friend-row">
                  <div class="friend-row__identity">
                    <div class="nq-avatar" aria-hidden="true">
                      @if (person.avatarUrl; as avatar) {
                        <img [src]="avatar" alt="" />
                      } @else {
                        {{ initials(person.displayName) }}
                      }
                    </div>
                    <div class="friend-row__text">
                      @if (person.status === 'friend') {
                        <a class="friend-row__name" [routerLink]="['/friends', person.id]">
                          {{ person.displayName }}
                        </a>
                        <small>Amigo conectado</small>
                      } @else {
                        <strong class="friend-row__name">{{ person.displayName }}</strong>
                        <small>
                          {{ person.status === 'incoming' ? 'Quer se conectar com você' : 'Aguardando resposta' }}
                        </small>
                      }
                    </div>
                  </div>

                  <div class="friend-row__actions">
                    @if (person.status === 'friend') {
                      <a class="nq-btn nq-btn--secondary friend-btn" [routerLink]="['/friends', person.id]">
                        <span class="ms-icon" aria-hidden="true">visibility</span>
                        Ver perfil
                      </a>
                    }
                    @if (person.status === 'incoming') {
                      <button
                        type="button"
                        class="nq-btn nq-btn--primary friend-btn"
                        [disabled]="busy()"
                        (click)="accept(person)"
                      >
                        <span class="ms-icon" aria-hidden="true">check</span>
                        Aceitar
                      </button>
                    }
                    <button
                      type="button"
                      class="nq-btn nq-btn--ghost friend-btn"
                      [disabled]="busy()"
                      (click)="remove(person)"
                    >
                      <span class="ms-icon" aria-hidden="true">
                        {{ person.status === 'friend' ? 'person_remove' : 'close' }}
                      </span>
                      {{
                        person.status === 'friend'
                          ? 'Remover amigo'
                          : person.status === 'incoming'
                            ? 'Recusar'
                            : 'Cancelar pedido'
                      }}
                    </button>
                  </div>
                </div>
              }
            </div>
          } @else {
            <p class="friends-empty">{{ busy() ? 'Carregando…' : group.empty }}</p>
          }
        </section>
      }
    </main>
  `,
  styles: `
    .friends-hero__title {
      margin-top: 10px;
    }

    .friends-hero__stats {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }

    .chip-icon {
      font-size: 15px;
    }

    .section-heading {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 12px;

      h2 {
        margin: 0;
        font-size: 1.12rem;
        display: inline-flex;
        align-items: center;
        gap: 8px;
      }
    }

    .section-icon {
      color: var(--accent-primary);
      font-size: 20px;
    }

    .friends-connect {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .friends-connect__grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
      gap: 18px;
    }

    .friends-connect__row {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 10px;

      input {
        flex: 1;
        min-width: 190px;
      }
    }

    .code-input {
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-size: 0.85rem !important;
      color: var(--accent-cyan) !important;
    }

    .friends-group {
      display: flex;
      flex-direction: column;
      gap: 14px;
    }

    .friends-list {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .friend-row {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: 12px 14px;
      border-radius: var(--radius-md);
      background: var(--bg-rail);
      border: 1px solid var(--border-subtle);
      transition: border-color 0.16s ease, background-color 0.16s ease;

      &:hover {
        border-color: var(--border-strong);
        background: var(--bg-surface-hover);
      }
    }

    .friend-row__identity {
      display: flex;
      align-items: center;
      gap: 12px;
      min-width: 0;
    }

    .friend-row__text {
      display: flex;
      flex-direction: column;
      min-width: 0;

      small {
        color: var(--text-muted);
        font-size: 0.78rem;
        margin-top: 2px;
      }
    }

    .friend-row__name {
      font-size: 0.96rem;
      font-weight: 600;
      color: var(--text-primary);
      text-decoration: none;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    a.friend-row__name:hover {
      color: var(--accent-primary);
    }

    .friend-row__actions {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px;
    }

    .friend-btn {
      padding: 8px 14px;
      font-size: 0.84rem;
    }

    .friends-empty {
      margin: 0;
      color: var(--text-muted);
      font-size: 0.9rem;
    }
  `,
})
export class FriendsPage implements OnInit {
  private readonly api = inject(SocialApi);
  private readonly destroyRef = inject(DestroyRef);
  protected code = '';
  protected readonly ownCode = signal('');
  protected readonly people = signal<Friend[]>([]);
  protected readonly busy = signal(false);
  protected readonly status = signal('');
  protected readonly error = signal('');

  protected readonly friendCount = computed(
    () => this.people().filter((person) => person.status === 'friend').length,
  );
  protected readonly incomingCount = computed(
    () => this.people().filter((person) => person.status === 'incoming').length,
  );

  protected readonly groups = computed(() =>
    [
      {
        status: 'friend',
        title: 'Meus amigos',
        icon: 'diversity_3',
        empty: 'Você ainda não tem amigos adicionados.',
      },
      {
        status: 'incoming',
        title: 'Pedidos recebidos',
        icon: 'inbox',
        empty: 'Nenhum pedido recebido.',
      },
      {
        status: 'outgoing',
        title: 'Pedidos enviados',
        icon: 'outbox',
        empty: 'Nenhum pedido enviado.',
      },
    ].map((group) => ({
      ...group,
      items: this.people().filter((person) => person.status === group.status),
    })),
  );

  ngOnInit(): void {
    this.load(this.api.friends());
  }

  protected initials(name: string): string {
    return name.trim().slice(0, 2).toUpperCase() || 'NQ';
  }

  protected send(): void {
    const code = this.code.trim().toLowerCase();
    if (!/^[a-f0-9]{20}$/.test(code)) {
      this.error.set('Informe um código de amizade válido.');
      return;
    }
    this.load(
      this.api.request(code).pipe(switchMap(() => this.api.friends())),
      () => {
        this.code = '';
        this.status.set('Lista de amizades atualizada.');
      },
    );
  }

  protected accept(person: Friend): void {
    this.load(
      this.api.accept(person.id).pipe(switchMap(() => this.api.friends())),
      () => this.status.set('Pedido aceito.'),
    );
  }

  protected remove(person: Friend): void {
    this.load(
      this.api.remove(person.id).pipe(switchMap(() => this.api.friends())),
      () => this.status.set('Lista de amizades atualizada.'),
    );
  }

  protected rotate(): void {
    if (this.busy()) return;
    this.busy.set(true);
    this.error.set('');
    this.status.set('');
    this.api.rotateCode().pipe(
      takeUntilDestroyed(this.destroyRef),
      finalize(() => this.busy.set(false)),
    ).subscribe({
      next: ({ code }) => {
        this.ownCode.set(code);
        this.status.set('Novo código gerado. O código anterior deixou de funcionar.');
      },
      error: (error: unknown) => this.error.set(parseApiError(error).message),
    });
  }

  protected async copy(code: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(code);
      this.status.set('Código copiado.');
    } catch {
      this.status.set('Selecione o código e copie manualmente.');
    }
  }

  private load(
    request: Observable<{ code: string; connections: Friend[] }>,
    saved?: () => void,
  ): void {
    if (this.busy()) return;
    this.busy.set(true);
    this.error.set('');
    this.status.set('');
    request
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.busy.set(false)),
      )
      .subscribe({
        next: ({ code, connections }) => {
          this.ownCode.set(code);
          this.people.set(connections);
          saved?.();
        },
        error: (error: unknown) => this.error.set(parseApiError(error).message),
      });
  }
}
