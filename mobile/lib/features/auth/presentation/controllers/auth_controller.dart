import 'package:flutter_riverpod/legacy.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:games_backlog/core/config/env_config.dart';
import 'package:games_backlog/core/network/api_client.dart';
import 'package:games_backlog/core/storage/session_storage.dart';
import 'package:games_backlog/features/auth/data/auth_repository.dart';
import 'package:games_backlog/features/auth/data/auth_repository_http.dart';
import 'package:games_backlog/features/auth/data/auth_repository_mock.dart';
import 'package:games_backlog/features/auth/data/models/auth_models.dart';
import 'package:games_backlog/features/auth/data/steam_pkce.dart';

final sessionStorageProvider = Provider<SessionStorage>((ref) {
  return InMemorySessionStorage();
});

final apiClientProvider = Provider<ApiClient>((ref) {
  final storage = ref.watch(sessionStorageProvider);
  return ApiClient(sessionStorage: storage);
});

final authRepositoryProvider = Provider<AuthRepository>((ref) {
  final storage = ref.watch(sessionStorageProvider);
  if (EnvConfig.useMockApi) {
    return AuthRepositoryMock(sessionStorage: storage);
  }
  final client = ref.watch(apiClientProvider);
  return AuthRepositoryHttp(apiClient: client, sessionStorage: storage);
});

enum AuthStatus { initial, loading, authenticated, unauthenticated, error }

class AuthState {
  final AuthStatus status;
  final String? email;
  final SessionResponse? session;
  final String? errorMessage;
  final bool isInitialized;

  const AuthState({
    this.status = AuthStatus.initial,
    this.email,
    this.session,
    this.errorMessage,
    this.isInitialized = false,
  });

  bool get isAuthenticated => status == AuthStatus.authenticated;

  AuthState copyWith({
    AuthStatus? status,
    String? email,
    SessionResponse? session,
    String? errorMessage,
    bool? isInitialized,
  }) {
    return AuthState(
      status: status ?? this.status,
      email: email ?? this.email,
      session: session ?? this.session,
      errorMessage: errorMessage,
      isInitialized: isInitialized ?? this.isInitialized,
    );
  }
}

class AuthController extends StateNotifier<AuthState> {
  final AuthRepository _repository;
  final SessionStorage _sessionStorage;

  AuthController({
    required AuthRepository repository,
    required SessionStorage sessionStorage,
    ApiClient? apiClient,
  })  : _repository = repository,
        _sessionStorage = sessionStorage,
        super(const AuthState()) {
    if (apiClient != null) {
      apiClient.onSessionExpired = onSessionExpired;
    }
    checkInitialSession();
  }

  Future<void> checkInitialSession() async {
    final hasToken = await _sessionStorage.hasSession();
    if (hasToken) {
      final token = await _sessionStorage.getAccessToken();
      final refreshToken = await _sessionStorage.getRefreshToken();
      final tokenType = await _sessionStorage.getTokenType() ?? 'Bearer';
      if (token != null && refreshToken != null) {
        state = state.copyWith(
          status: AuthStatus.authenticated,
          session: SessionResponse(
            tokenType: tokenType,
            accessToken: token,
            refreshToken: refreshToken,
            expiresIn: 900,
          ),
          isInitialized: true,
        );
        return;
      }
    }
    state = state.copyWith(
      status: AuthStatus.unauthenticated,
      isInitialized: true,
    );
  }

  Future<bool> login(String email, String password) async {
    state = state.copyWith(status: AuthStatus.loading, errorMessage: null);
    try {
      final session = await _repository.login(email.trim(), password);
      state = state.copyWith(
        status: AuthStatus.authenticated,
        email: email.trim(),
        session: session,
      );
      return true;
    } catch (e) {
      state = state.copyWith(
        status: AuthStatus.error,
        errorMessage: e.toString(),
      );
      return false;
    }
  }

  Future<bool> register(String email, String password) async {
    state = state.copyWith(status: AuthStatus.loading, errorMessage: null);
    try {
      await _repository.register(email.trim(), password);
      state = state.copyWith(
        status: AuthStatus.unauthenticated,
        email: email.trim(),
      );
      return true;
    } catch (e) {
      state = state.copyWith(
        status: AuthStatus.error,
        errorMessage: e.toString(),
      );
      return false;
    }
  }

  Future<bool> resendConfirmationEmail(String email) async {
    state = state.copyWith(status: AuthStatus.loading, errorMessage: null);
    try {
      await _repository.resendConfirmationEmail(email.trim());
      state = state.copyWith(status: AuthStatus.unauthenticated);
      return true;
    } catch (e) {
      state = state.copyWith(
        status: AuthStatus.error,
        errorMessage: e.toString(),
      );
      return false;
    }
  }

  Future<bool> forgotPassword(String email) async {
    state = state.copyWith(status: AuthStatus.loading, errorMessage: null);
    try {
      await _repository.forgotPassword(email.trim());
      state = state.copyWith(status: AuthStatus.unauthenticated);
      return true;
    } catch (e) {
      state = state.copyWith(
        status: AuthStatus.error,
        errorMessage: e.toString(),
      );
      return false;
    }
  }

  Future<bool> resetPassword(String email, String code, String newPassword) async {
    state = state.copyWith(status: AuthStatus.loading, errorMessage: null);
    try {
      await _repository.resetPassword(email.trim(), code.trim(), newPassword);
      state = state.copyWith(status: AuthStatus.unauthenticated);
      return true;
    } catch (e) {
      state = state.copyWith(
        status: AuthStatus.error,
        errorMessage: e.toString(),
      );
      return false;
    }
  }

  Future<void> logout() async {
    await _repository.logout();
    state = const AuthState(
      status: AuthStatus.unauthenticated,
      isInitialized: true,
    );
  }

  // Steam Auth Methods
  Future<(SteamAuthStartResponse, SteamPkce)?> initiateSteamFlow({bool isLink = false}) async {
    state = state.copyWith(status: AuthStatus.loading, errorMessage: null);
    try {
      final pkce = SteamPkce.generate();
      final startRes = await _repository.startSteamAuth(
        codeChallenge: pkce.codeChallenge,
        isLink: isLink,
      );
      await _sessionStorage.savePendingSteamAuth(
        PendingSteamAuth(
          state: startRes.state,
          codeVerifier: pkce.codeVerifier,
          isLink: isLink,
        ),
      );
      state = state.copyWith(status: state.isAuthenticated ? AuthStatus.authenticated : AuthStatus.unauthenticated);
      return (startRes, pkce);
    } catch (e) {
      state = state.copyWith(
        status: AuthStatus.error,
        errorMessage: e.toString(),
      );
      return null;
    }
  }

  Future<bool> completeSteamLogin({
    required String stateParam,
    required String code,
    required String codeVerifier,
  }) async {
    state = state.copyWith(status: AuthStatus.loading, errorMessage: null);
    try {
      final session = await _repository.redeemSteamToken(
        state: stateParam,
        code: code,
        codeVerifier: codeVerifier,
      );
      state = state.copyWith(
        status: AuthStatus.authenticated,
        email: 'Conta Steam',
        session: session,
      );
      return true;
    } catch (e) {
      state = state.copyWith(
        status: AuthStatus.error,
        errorMessage: e.toString(),
      );
      return false;
    }
  }

  Future<bool> completeSteamLink({
    required String stateParam,
    required String code,
    required String codeVerifier,
  }) async {
    state = state.copyWith(status: AuthStatus.loading, errorMessage: null);
    try {
      await _repository.linkSteamAccount(
        state: stateParam,
        code: code,
        codeVerifier: codeVerifier,
      );
      state = state.copyWith(status: AuthStatus.authenticated);
      return true;
    } catch (e) {
      state = state.copyWith(
        status: AuthStatus.error,
        errorMessage: e.toString(),
      );
      return false;
    }
  }

  void onSessionExpired() {
    state = const AuthState(
      status: AuthStatus.unauthenticated,
      errorMessage: 'Sua sessão expirou. Por favor, faça login novamente.',
      isInitialized: true,
    );
  }

  void clearError() {
    if (state.errorMessage != null) {
      state = state.copyWith(
        status: state.isAuthenticated ? AuthStatus.authenticated : AuthStatus.unauthenticated,
        errorMessage: null,
      );
    }
  }
}

final authControllerProvider = StateNotifierProvider<AuthController, AuthState>((ref) {
  final repository = ref.watch(authRepositoryProvider);
  final storage = ref.watch(sessionStorageProvider);
  final client = ref.watch(apiClientProvider);
  return AuthController(
    repository: repository,
    sessionStorage: storage,
    apiClient: client,
  );
});
