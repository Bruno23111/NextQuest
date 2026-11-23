import { RouterLink } from '@angular/router';
import { DiscordSettingsComponent } from '../../discord/discord-settings.component';
import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AuthStore } from '../../../core/auth/auth.store';
import { parseApiError } from '../../../core/errors/problem-details';
import { UserProfileStore } from '../../../core/profile/user-profile.store';
import { FeedbackBannerComponent } from '../../../shared/components/feedback-banner.component';
import { ProfileApi } from '../services/profile.api';

@Component({
  selector: 'app-profile-page',
  standalone: true,
  imports: [RouterLink, DiscordSettingsComponent, FormsModule, FeedbackBannerComponent],
  template: `
    <div class="nq-page">
      <app-feedback-banner [message]="errorMessage()" tone="error" />
      <app-feedback-banner [message]="successMessage()" tone="success" />

      @if (loading()) {
        <div class="nq-card">Carregando perfil...</div>
      } @else {
        <section class="profile-preview">
          <input #headerPicker hidden type="file" accept="image/png,image/jpeg,image/webp"
            (change)="selectImage($event, 'header')" />
          <input #avatarPicker hidden type="file" accept="image/png,image/jpeg,image/webp"
            (change)="selectImage($event, 'avatar')" />

          <button type="button" class="profile-banner image-picker" aria-label="Alterar imagem de capa"
            [disabled]="saving()" (click)="headerPicker.click()"
            [style.background-image]="previewUrl('header') ? 'url(' + previewUrl('header') + ')' : null">
            <span class="profile-banner__scrim"></span>
            <span class="ms-icon edit-image" aria-hidden="true">edit</span>
          </button>

          <div class="profile-identity">
            <button type="button" class="avatar-ring image-picker" aria-label="Alterar imagem de perfil"
              [disabled]="saving()" (click)="avatarPicker.click()">
              @if (previewUrl('avatar')) {
                <img [src]="previewUrl('avatar')" alt="" />
              } @else {
                <span>{{ (displayName || 'NQ').slice(0, 2).toUpperCase() }}</span>
              }
              <span class="ms-icon edit-image" aria-hidden="true">edit</span>
            </button>

            <div class="identity-text">
              <h1>{{ displayName || 'Jogador NextQuest' }}</h1>
              <p>{{ bio || 'Adicione uma descrição para personalizar seu perfil.' }}</p>
            </div>


          </div>
        </section>

        <div class="profile-grid">
          <form class="nq-card profile-form" (ngSubmit)="save()">
            <h2>Editar perfil (prévia ao vivo acima)</h2>

            <div class="form-grid">
              <div class="nq-field">
                <label for="prof-name">Nome de exibição (máx. 60)</label>
                <input
                  id="prof-name"
                  name="displayName"
                  [(ngModel)]="displayName"
                  required
                  maxlength="60"
                />
              </div>
            </div>

            <div class="nq-field">
              <label for="prof-bio">Descrição (máx. 300)</label>
              <textarea
                id="prof-bio"
                name="bio"
                rows="3"
                [(ngModel)]="bio"
                maxlength="300"
                placeholder="Conte sobre seus gêneros favoritos ou metas de backlog..."
              ></textarea>
            </div>

            <small class="upload-hint">PNG, JPEG ou WebP, até 8 MB por imagem.</small>
            <div>
              <button type="submit" class="nq-btn nq-btn--primary" [disabled]="saving()">
                <span class="ms-icon" aria-hidden="true">save</span>
                {{ saving() ? 'Salvando...' : 'Salvar perfil' }}
              </button>
            </div>
          </form>

          <app-discord-settings>
            <section class="steam-integration" aria-labelledby="steam-integration-title">
              <div>
                <h3 id="steam-integration-title">Steam</h3>
                <p>{{ profileStore.profile()?.steamLinked ? 'Conta vinculada' : 'Conta desconectada' }}</p>
              </div>
              @if (profileStore.profile()?.steamLinked) {
                <a class="nq-btn nq-btn--secondary" routerLink="/backlog"
                  [queryParams]="{ collection: 'steam' }">Abrir biblioteca Steam</a>
              } @else {
                <button type="button" class="nq-btn nq-btn--secondary"
                  [disabled]="linkingSteam()" (click)="linkSteam()">
                  {{ linkingSteam() ? 'Conectando…' : 'Vincular conta Steam' }}
                </button>
              }
            </section>
          </app-discord-settings>
        </div>
      }
    </div>
  `,
  styles: `
    .steam-integration {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: 12px;
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-md);
    }

    .steam-integration h3 { margin: 0; }
    .steam-integration p { margin: 4px 0 0; color: var(--text-muted); }

    .profile-preview {
      border-radius: var(--radius-xl);
      overflow: hidden;
      background: var(--bg-surface);
      border: 1px solid var(--border-subtle);
      box-shadow: var(--shadow-card);
    }

    .profile-banner {
      position: relative;
      display: block;
      width: 100%;
      border: 0;
      padding: 0;
      height: 196px;
      background:
        radial-gradient(circle at 25% 20%, rgba(11, 105, 122, 0.45), transparent 56%),
        radial-gradient(circle at 80% 70%, rgba(181, 227, 76, 0.14), transparent 50%),
        linear-gradient(135deg, var(--teal-dark), var(--bg-rail));
      background-size: cover;
      background-position: center;
    }

    .profile-banner__scrim {
      position: absolute;
      inset: 0;
      background: linear-gradient(to top, var(--bg-surface) 4%, rgba(16, 17, 19, 0.25) 70%);
    }

    .profile-identity {
      padding: 0 24px 24px;
      margin-top: -46px;
      position: relative;
      display: flex;
      flex-wrap: wrap;
      align-items: flex-end;
      gap: 18px;
    }

    .avatar-ring {
      padding: 0;
      width: 96px;
      height: 96px;
      border-radius: 22px;
      overflow: hidden;
      border: 3px solid var(--accent-primary);
      background: var(--bg-surface-elevated);
      display: grid;
      place-items: center;
      font-size: 1.65rem;
      font-weight: 800;
      color: var(--accent-primary);
      box-shadow: var(--shadow-glow);

      img {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }
    }

    .identity-text {
      flex: 1;
      min-width: 220px;

      h1 {
        margin: 0 0 6px;
        font-size: 1.5rem;
      }

      p {
        margin: 0;
        color: var(--text-secondary);
      }
    }

    .profile-form {
      display: flex;
      flex-direction: column;
      gap: 16px;

      h2 {
        margin: 0;
        font-size: 1.15rem;
      }
    }

    .form-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
      gap: 14px;
    }

    .image-picker { position: relative; cursor: pointer; }
    .image-picker:disabled { cursor: wait; }
    .image-picker:focus-visible { outline: 2px solid var(--accent-primary); outline-offset: -4px; }

    .edit-image {
      position: absolute;
      right: 8px;
      bottom: 8px;
      display: grid;
      place-items: center;
      width: 30px;
      height: 30px;
      border-radius: 50%;
      color: white;
      background: rgba(16, 17, 19, 0.85);
      font-size: 18px;
    }

    .profile-banner .edit-image { top: 12px; right: 12px; bottom: auto; }

    .profile-grid {
      display: grid;
      grid-template-columns: 1.25fr 1fr;
      gap: 20px;
      align-items: start;
    }

    @media (max-width: 900px) {
      .profile-grid {
        grid-template-columns: 1fr;
      }
    }

    .upload-hint {
      color: var(--text-muted);
    }
  `,
})
export class ProfilePageComponent implements OnInit, OnDestroy {
  private readonly api = inject(ProfileApi);
  private readonly auth = inject(AuthStore);
  protected readonly profileStore = inject(UserProfileStore);

  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly linkingSteam = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly successMessage = signal<string | null>(null);

  protected displayName = '';
  protected bio = '';
  protected avatarUrl = '';
  protected headerUrl = '';

  private readonly selectedImages: Partial<Record<'avatar' | 'header', { file: File; url: string }>> = {};

  protected selectImage(event: Event, kind: 'avatar' | 'header'): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;

    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 8 * 1024 * 1024) {
      this.errorMessage.set('Selecione uma imagem PNG, JPEG ou WebP de até 8 MB.');
      return;
    }

    this.errorMessage.set(null);
    this.clearPreview(kind);
    this.selectedImages[kind] = { file, url: URL.createObjectURL(file) };
  }


  protected previewUrl(kind: 'avatar' | 'header'): string {
    return this.selectedImages[kind]?.url ?? (kind === 'avatar' ? this.avatarUrl : this.headerUrl);
  }

  ngOnDestroy(): void {
    this.clearPreview('avatar');
    this.clearPreview('header');
  }

  private clearPreview(kind: 'avatar' | 'header'): void {
    const selected = this.selectedImages[kind];
    if (selected) URL.revokeObjectURL(selected.url);
    delete this.selectedImages[kind];
  }

  ngOnInit(): void {
    this.api.getProfile().subscribe({
      next: (profile) => {
        this.profileStore.setProfile(profile);
        this.displayName = profile.displayName ?? '';
        this.bio = profile.bio ?? '';
        this.avatarUrl = profile.avatarUrl ?? '';
        this.headerUrl = profile.headerUrl ?? '';
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        this.errorMessage.set(parseApiError(err).message);
      },
    });
  }

  protected save(): void {
    this.saving.set(true);
    this.errorMessage.set(null);
    this.successMessage.set(null);

    const payload = new FormData();
    payload.set('displayName', this.displayName.trim());
    payload.set('bio', this.bio.trim());
    for (const kind of ['avatar', 'header'] as const) {
      const selected = this.selectedImages[kind];
      if (selected) payload.set(kind, selected.file);
    }

    this.api.updateProfile(payload).subscribe({
      next: (updated) => {
        this.clearPreview('avatar');
        this.clearPreview('header');
        this.profileStore.setProfile(updated);
        this.displayName = updated.displayName;
        this.bio = updated.bio ?? '';
        this.avatarUrl = updated.avatarUrl ?? '';
        this.headerUrl = updated.headerUrl ?? '';
        this.saving.set(false);
        this.successMessage.set('Perfil atualizado com sucesso!');
      },
      error: (err) => {
        this.saving.set(false);
        this.errorMessage.set(parseApiError(err).message);
      },
    });
  }

  protected async linkSteam(): Promise<void> {
    this.linkingSteam.set(true);
    this.errorMessage.set(null);
    try {
      const url = await this.auth.beginSteamFlow('link');
      window.location.assign(url);
    } catch (err) {
      this.linkingSteam.set(false);
      this.errorMessage.set(parseApiError(err).message);
    }
  }
}
