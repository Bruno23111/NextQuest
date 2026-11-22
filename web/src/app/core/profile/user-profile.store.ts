import { Injectable, inject, signal } from '@angular/core';
import { ProfileApi } from '../../features/profile/services/profile.api';
import { UserProfile } from '../models/api.models';

@Injectable({ providedIn: 'root' })
export class UserProfileStore {
  private readonly profileApi = inject(ProfileApi);

  readonly profile = signal<UserProfile | null>(null);
  readonly loaded = signal(false);

  load(force = false): void {
    if (this.loaded() && !force) return;

    this.profileApi.getProfile().subscribe({
      next: (profile) => {
        this.profile.set(profile);
        this.loaded.set(true);
      },
      error: () => {
        // Falha silenciosa para não bloquear a navegação no shell.
      },
    });
  }

  setProfile(profile: UserProfile): void {
    this.profile.set(profile);
    this.loaded.set(true);
  }

  clear(): void {
    this.profile.set(null);
    this.loaded.set(false);
  }
}
