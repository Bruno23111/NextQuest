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
  imports: [FormsModule, FeedbackBannerComponent],
  template: `
    <div class="nq-page">
      <app-feedback-banner [message]="errorMessage()" tone="error" />
      <app-feedback-banner [message]="successMessage()" tone="success" />

      @if (loading()) {
        <div class="nq-card">Carregando perfil...</div>
      } @else {
        <section class="profile-preview">
          <div
            class="profile-banner"
            [style.background-image]="previewUrl('header') ? 'url(' + previewUrl('header') + ')' : null"
          >
            <div class="profile-banner__scrim"></div>
          </div>

          <div class="profile-identity">
            <div class="avatar-ring">
              @if (previewUrl('avatar')) {
                <img [src]="previewUrl('avatar')" [alt]="displayName || 'Avatar'" />
              } @else {
                <span>{{ (displayName || 'NQ').slice(0, 2).toUpperCase() }}</span>
              }
            </div>

            <div class="identity-text">
              <h1>{{ displayName || 'Jogador NextQuest' }}</h1>
              <p>{{ bio || 'Adicione uma descrição para personalizar seu perfil.' }}</p>
            </div>

            <button
              type="button"
              class="nq-btn nq-btn--secondary"
              [disabled]="linkingSteam()"
              (click)="linkSteam()"
            >
              <span class="ms-icon" aria-hidden="true">sports_esports</span>
              {{ linkingSteam() ? 'Conectando...' : 'Vincular conta Steam' }}
            </button>
          </div>
        </section>

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

            <div class="nq-field">
              <label for="prof-avatar">Imagem de perfil</label>
              <label class="file-drop" for="prof-avatar">
                <span class="ms-icon" aria-hidden="true">photo_camera</span>
                <span>{{ selectedFileName('avatar') || 'Escolher avatar (PNG, JPEG, WebP)' }}</span>
                <input
                  id="prof-avatar"
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  [disabled]="saving()"
                  (change)="selectImage($event, 'avatar')"
                />
              </label>
            </div>

            <div class="nq-field">
              <label for="prof-header">Imagem de capa</label>
              <label class="file-drop" for="prof-header">
                <span class="ms-icon" aria-hidden="true">wallpaper</span>
                <span>{{ selectedFileName('header') || 'Escolher capa (PNG, JPEG, WebP)' }}</span>
                <input
                  id="prof-header"
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  [disabled]="saving()"
                  (change)="selectImage($event, 'header')"
                />
              </label>
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

          <small class="upload-hint">PNG, JPEG ou WebP, até 2 MB por imagem.</small>
          <div>
            <button type="submit" class="nq-btn nq-btn--primary" [disabled]="saving()">
              <span class="ms-icon" aria-hidden="true">save</span>
              {{ saving() ? 'Salvando...' : 'Salvar perfil' }}
            </button>
          </div>
        </form>
      }
    </div>
  `,
  styles: `
    .profile-preview {
      border-radius: var(--radius-xl);
      overflow: hidden;
      background: var(--bg-surface);
      border: 1px solid var(--border-subtle);
      box-shadow: var(--shadow-card);
    }

    .profile-banner {
      position: relative;
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

    .file-drop {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 10px 13px;
      border-radius: var(--radius-md);
      border: 1px dashed var(--border-strong);
      background: var(--bg-input);
      color: var(--text-secondary);
      font-size: 0.86rem;
      font-weight: 500;
      cursor: pointer;
      transition: border-color 0.15s ease, color 0.15s ease;

      &:hover {
        border-color: var(--accent-primary);
        color: var(--text-primary);
      }

      .ms-icon {
        color: var(--accent-primary);
      }

      span:last-of-type {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      input[type='file'] {
        display: none;
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
  private readonly profileStore = inject(UserProfileStore);

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

    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 2 * 1024 * 1024) {
      this.errorMessage.set('Selecione uma imagem PNG, JPEG ou WebP de até 2 MB.');
      return;
    }

    this.errorMessage.set(null);
    this.clearPreview(kind);
    this.selectedImages[kind] = { file, url: URL.createObjectURL(file) };
  }

  protected selectedFileName(kind: 'avatar' | 'header'): string | null {
    return this.selectedImages[kind]?.file.name ?? null;
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
