export type GameStatus = 'planned' | 'playing' | 'completed' | 'dropped';

export interface SessionResponse {
  tokenType: string;
  accessToken: string;
  expiresIn: number;
  refreshToken: string;
}

export interface CredentialsRequest {
  email: string;
  password: string;
}

export interface EmailRequest {
  email: string;
}

export interface ResetPasswordRequest {
  email: string;
  resetCode: string;
  newPassword: string;
}

export interface StartSteamRequest {
  codeChallenge: string;
}

export interface StartSteamResponse {
  state: string;
  authorizationUrl: string;
  expiresIn: number;
}

export interface RedeemSteamRequest {
  state: string;
  code: string;
  codeVerifier: string;
}

export interface BacklogGame {
  id: string;
  title: string;
  platform: string;
  status: GameStatus;
  rawgId: number | null;
  platformId: number | null;
  coverUrl: string | null;
  createdAt: string;
}

export interface CreateGameRequest {
  title: string;
  platform: string;
}

export interface UpdateGameRequest {
  title?: string | null;
  platform?: string | null;
  status?: GameStatus | null;
}

export interface ImportGameRequest {
  rawgId: number;
  platformId: number;
}

export interface PagedResult<T> {
  items: T[];
  page: number;
  pageSize: number;
  hasMore: boolean;
}

export interface CatalogPlatform {
  id: number;
  name: string;
}

export interface CatalogGame {
  rawgId: number;
  title: string;
  coverUrl: string | null;
  platforms: CatalogPlatform[];
  metacriticScore?: number | null;
  metacriticUrl?: string | null;
}

export interface SteamLibraryGame {
  appId: number;
  name: string;
  playtimeForeverMinutes: number;
  playtimeTwoWeeksMinutes: number | null;
  iconUrl: string | null;
}

export interface SteamLibrary {
  gameCount: number;
  games: SteamLibraryGame[];
}

export interface SteamAchievement {
  apiName: string;
  name: string;
  description: string | null;
  achieved: boolean;
  unlockedAt: string | null;
  iconUrl: string | null;
  grayIconUrl: string | null;
}

export interface SteamGameAchievements {
  appId: number;
  gameName: string;
  unlockedCount: number;
  totalCount: number;
  achievements: SteamAchievement[];
}

export interface UserProfile {
  steamLinked?: boolean;
  displayName: string;
  bio: string | null;
  avatarUrl: string | null;
  headerUrl: string | null;
}

export interface UpdateUserProfileRequest {
  displayName: string;
  bio: string | null;
  avatarUrl: string | null;
  headerUrl: string | null;
}

export interface ProblemDetails {
  type?: string;
  title?: string;
  status?: number;
  detail?: string;
  errors?: Record<string, string[]>;
}
