import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { ProfileApi } from '../../features/profile/services/profile.api';
import { UserProfile } from '../models/api.models';
import { UserProfileStore } from './user-profile.store';

describe('UserProfileStore', () => {
  const sampleProfile: UserProfile = {
    displayName: 'Bruno',
    bio: 'Jogando indies',
    avatarUrl: 'https://example.com/avatar.png',
    headerUrl: null,
  };

  it('loads profile once and caches until force or clear', () => {
    const getProfile = vi.fn(() => of(sampleProfile));
    TestBed.configureTestingModule({
      providers: [{ provide: ProfileApi, useValue: { getProfile } }],
    });

    const store = TestBed.inject(UserProfileStore);
    store.load();
    store.load();

    expect(getProfile).toHaveBeenCalledTimes(1);
    expect(store.loaded()).toBe(true);
    expect(store.profile()?.displayName).toBe('Bruno');

    store.load(true);
    expect(getProfile).toHaveBeenCalledTimes(2);
  });

  it('updates and clears profile state via setProfile and clear', () => {
    TestBed.configureTestingModule({
      providers: [{ provide: ProfileApi, useValue: { getProfile: vi.fn() } }],
    });

    const store = TestBed.inject(UserProfileStore);
    store.setProfile(sampleProfile);
    expect(store.loaded()).toBe(true);
    expect(store.profile()).toEqual(sampleProfile);

    store.clear();
    expect(store.loaded()).toBe(false);
    expect(store.profile()).toBeNull();
  });
});
