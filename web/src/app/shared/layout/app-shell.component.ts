import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import {
  NavigationEnd,
  Router,
  RouterLink,
  RouterLinkActive,
  RouterOutlet,
} from '@angular/router';
import { filter } from 'rxjs';
import { AuthStore } from '../../core/auth/auth.store';
import { GameStatus } from '../../core/models/api.models';
import { UserProfileStore } from '../../core/profile/user-profile.store';

interface TopTab {
  label: string;
  status: GameStatus | null;
}

const TOP_TABS: TopTab[] = [
  { label: 'Meus jogos', status: null },
  { label: 'Jogando', status: 'playing' },
  { label: 'Planejados', status: 'planned' },
  { label: 'Zerados', status: 'completed' },
];

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, FormsModule],
  template: `
    <div
      class="shell"
      [class.shell--expanded]="railExpanded()"
      [class.shell--menu-open]="mobileMenuOpen()"
    >
      <aside class="rail" aria-label="Menu lateral">
        <div class="rail__brand-row">
          <a class="brand" routerLink="/backlog" (click)="closeMobileMenu()">
            <img class="brand__logo" src="nextquest.png" alt="NextQuest" width="40" height="40" />
            <span class="rail__label brand__text">
              <strong>NextQuest</strong>
              <small>Game Library</small>
            </span>
          </a>

          <button
            type="button"
            class="nq-icon-circle nq-icon-circle--sm rail__toggle"
            (click)="railExpanded.set(!railExpanded())"
            [attr.aria-label]="railExpanded() ? 'Recolher menu' : 'Expandir menu'"
            [attr.data-tooltip]="railExpanded() ? null : 'Expandir menu'"
          >
            <span class="ms-icon" aria-hidden="true">
              {{ railExpanded() ? 'keyboard_double_arrow_left' : 'keyboard_double_arrow_right' }}
            </span>
          </button>
        </div>

        <button
          type="button"
          class="rail__item"
          data-tooltip="Buscar jogos"
          (click)="focusSearch()"
        >
          <span class="ms-icon" aria-hidden="true">search</span>
          <span class="rail__label">Buscar jogos</span>
        </button>

        <div class="rail__divider" role="separator"></div>

        <nav class="rail__nav" aria-label="Navegação principal">
          <a
            class="rail__item"
            routerLink="/backlog"
            [class.is-active]="isLibraryRootActive()"
            data-tooltip="Biblioteca"
            (click)="closeMobileMenu()"
          >
            <span class="ms-icon" aria-hidden="true">grid_view</span>
            <span class="rail__label">Biblioteca</span>
          </a>

          <a
            class="rail__item"
            routerLink="/catalog"
            routerLinkActive="is-active"
            data-tooltip="Catálogo RAWG"
            (click)="closeMobileMenu()"
          >
            <span class="ms-icon" aria-hidden="true">storefront</span>
            <span class="rail__label">Catálogo RAWG</span>
          </a>

          <a
            class="rail__item"
            routerLink="/steam"
            routerLinkActive="is-active"
            data-tooltip="Steam & Conquistas"
            (click)="closeMobileMenu()"
          >
            <span class="ms-icon" aria-hidden="true">sports_esports</span>
            <span class="rail__label">Steam</span>
          </a>

          <a
            class="rail__item"
            routerLink="/backlog"
            [queryParams]="{ status: 'planned' }"
            [class.is-active]="activeCollection() === 'planned'"
            data-tooltip="Planejados"
            (click)="closeMobileMenu()"
          >
            <span class="ms-icon" aria-hidden="true">bookmark_border</span>
            <span class="rail__label">Planejados</span>
          </a>
        </nav>

        <div class="rail__footer">
          <div class="rail__divider" role="separator"></div>

          <a
            class="rail__item"
            routerLink="/profile"
            routerLinkActive="is-active"
            data-tooltip="Perfil e conta"
            (click)="closeMobileMenu()"
          >
            <span class="ms-icon" aria-hidden="true">settings</span>
            <span class="rail__label">Perfil</span>
          </a>

          <button
            type="button"
            class="rail__item"
            data-tooltip="Sair da conta"
            (click)="logout()"
          >
            <span class="ms-icon" aria-hidden="true">logout</span>
            <span class="rail__label">Sair</span>
          </button>
        </div>
      </aside>

      @if (mobileMenuOpen()) {
        <button
          type="button"
          class="backdrop"
          aria-label="Fechar menu"
          (click)="closeMobileMenu()"
        ></button>
      }

      <div class="workspace">
        <header class="topbar">
          <div class="topbar__left">
            <button
              type="button"
              class="nq-icon-circle menu-toggle"
              (click)="mobileMenuOpen.set(!mobileMenuOpen())"
              aria-label="Abrir navegação"
            >
              <span class="ms-icon" aria-hidden="true">menu</span>
            </button>

            <div class="greeting">
              <strong>Olá, {{ displayName() }}!</strong>
              <small>Aqui está seu progresso recente</small>
            </div>
          </div>

          <nav class="topbar__tabs" aria-label="Filtros rápidos da biblioteca">
            @for (tab of topTabs; track tab.label) {
              <a
                class="top-pill"
                routerLink="/backlog"
                [queryParams]="tab.status ? { status: tab.status } : {}"
                [class.is-active]="isTopTabActive(tab.status)"
              >
                {{ tab.label }}
              </a>
            }
          </nav>

          <div class="topbar__actions">
            @if (searchOpen()) {
              <form class="quick-search" (ngSubmit)="searchCatalog()">
                <span class="ms-icon quick-search__icon" aria-hidden="true">search</span>
                <input
                  type="search"
                  name="quickQuery"
                  [(ngModel)]="quickQuery"
                  placeholder="Buscar no catálogo RAWG..."
                  aria-label="Buscar jogos no catálogo RAWG"
                  autofocus
                />
                <button
                  type="button"
                  class="quick-search__close"
                  aria-label="Fechar busca"
                  (click)="searchOpen.set(false)"
                >
                  <span class="ms-icon" aria-hidden="true">close</span>
                </button>
              </form>
            } @else {
              <button
                type="button"
                class="nq-icon-circle"
                aria-label="Buscar no catálogo"
                title="Buscar no catálogo"
                (click)="searchOpen.set(true)"
              >
                <span class="ms-icon" aria-hidden="true">search</span>
              </button>
            }

            <a
              routerLink="/backlog"
              [queryParams]="{ novo: 1 }"
              class="nq-icon-circle"
              aria-label="Adicionar jogo"
              title="Adicionar jogo"
            >
              <span class="ms-icon" aria-hidden="true">add</span>
            </a>

            <a
              routerLink="/profile"
              class="nq-avatar nq-avatar--online"
              aria-label="Abrir perfil"
              title="Meu perfil"
            >
              @if (profile()?.avatarUrl; as avatar) {
                <img [src]="avatar" [alt]="displayName()" />
              } @else {
                <span>{{ initials() }}</span>
              }
            </a>
          </div>
        </header>

        <main class="content">
          <router-outlet />
        </main>
      </div>
    </div>
  `,
  styleUrl: './app-shell.component.scss',
})
export class AppShellComponent implements OnInit {
  private readonly auth = inject(AuthStore);
  private readonly profileStore = inject(UserProfileStore);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly topTabs = TOP_TABS;
  protected readonly railExpanded = signal(false);
  protected readonly mobileMenuOpen = signal(false);
  protected readonly searchOpen = signal(false);
  protected readonly currentUrl = signal(this.router.url);
  protected readonly profile = this.profileStore.profile;

  protected readonly displayName = computed(
    () => this.profile()?.displayName?.trim() || 'Jogador',
  );

  protected readonly initials = computed(
    () =>
      this.displayName()
        .split(/\s+/)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase() ?? '')
        .join('') || 'NQ',
  );

  private readonly routeState = computed(() => {
    const parsed = this.router.parseUrl(this.currentUrl());
    const primary = parsed.root.children['primary']?.segments.map((s) => s.path) ?? [];
    const firstSegment = primary[0] ?? '';
    const status = parsed.queryParams['status'];
    const parsedStatus: GameStatus | null =
      status === 'planned' ||
      status === 'playing' ||
      status === 'completed' ||
      status === 'dropped'
        ? status
        : null;

    return { firstSegment, status: parsedStatus };
  });

  protected readonly activeCollection = computed(() => {
    const { firstSegment, status } = this.routeState();
    return firstSegment === 'backlog' ? status : null;
  });

  protected readonly isLibraryRootActive = computed(() => {
    const { firstSegment, status } = this.routeState();
    return firstSegment === 'backlog' && status !== 'planned';
  });

  protected quickQuery = '';

  ngOnInit(): void {
    this.profileStore.load();
    this.router.events
      .pipe(
        filter((event): event is NavigationEnd => event instanceof NavigationEnd),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((event) => {
        this.currentUrl.set(event.urlAfterRedirects);
      });
  }

  protected isTopTabActive(status: GameStatus | null): boolean {
    const state = this.routeState();
    return state.firstSegment === 'backlog' && state.status === status;
  }

  protected focusSearch(): void {
    this.searchOpen.set(true);
    this.closeMobileMenu();
  }

  protected closeMobileMenu(): void {
    this.mobileMenuOpen.set(false);
  }

  protected searchCatalog(): void {
    const q = this.quickQuery.trim();
    if (!q) return;
    void this.router.navigate(['/catalog'], { queryParams: { q } });
  }

  protected logout(): void {
    this.profileStore.clear();
    this.auth.logout(true);
  }
}
