import 'package:games_backlog/core/models/api_error.dart';
import 'package:games_backlog/core/storage/session_storage.dart';
import 'auth_repository.dart';
import 'models/auth_models.dart';

class AuthRepositoryMock implements AuthRepository {
  final SessionStorage sessionStorage;

  // In-memory registered users for mock demonstration
  final Map<String, String> _users = {
    'jogadora@example.org': 'senha-de-exemplo',
    'demo@gamesbacklog.com': '12345678',
  };

  AuthRepositoryMock({required this.sessionStorage});

  @override
  Future<void> register(String email, String password) async {
    await Future.delayed(const Duration(milliseconds: 300));
    if (!email.contains('@') || password.length < 6) {
      throw const AppApiException('E-mail ou senha inválidos.');
    }
    _users[email] = password;
  }

  @override
  Future<String> confirmEmail(String userId, String code) async {
    await Future.delayed(const Duration(milliseconds: 200));
    return 'E-mail confirmado com sucesso!';
  }

  @override
  Future<void> resendConfirmationEmail(String email) async {
    await Future.delayed(const Duration(milliseconds: 300));
    // Always 204 in OpenAPI
  }

  @override
  Future<SessionResponse> login(String email, String password) async {
    await Future.delayed(const Duration(milliseconds: 400));

    if (email == 'unconfirmed@example.org') {
      throw const AppApiException('Credenciais inválidas ou conta indisponível.', statusCode: 401);
    }

    final storedPassword = _users[email];
    if (storedPassword == null || storedPassword != password) {
      // In mock, also allow the example credentials from auth.json
      if (email != 'jogadora@example.org' && email != 'demo@gamesbacklog.com') {
        throw const AppApiException('Credenciais inválidas ou conta indisponível.', statusCode: 401);
      }
    }

    // Example session response from specs/examples/auth.json
    final session = SessionResponse(
      tokenType: 'Bearer',
      accessToken: 'token-opaco-de-exemplo-${DateTime.now().millisecondsSinceEpoch}',
      expiresIn: 900,
      refreshToken: 'token-de-renovacao-de-exemplo-${DateTime.now().millisecondsSinceEpoch}',
    );

    await sessionStorage.saveTokens(
      tokenType: session.tokenType,
      accessToken: session.accessToken,
      refreshToken: session.refreshToken,
      expiresIn: session.expiresIn,
    );

    return session;
  }

  @override
  Future<SessionResponse> refresh(String refreshToken) async {
    await Future.delayed(const Duration(milliseconds: 200));
    final session = SessionResponse(
      tokenType: 'Bearer',
      accessToken: 'token-opaco-de-exemplo-renovado-${DateTime.now().millisecondsSinceEpoch}',
      expiresIn: 900,
      refreshToken: 'token-de-renovacao-de-exemplo-${DateTime.now().millisecondsSinceEpoch}',
    );
    await sessionStorage.saveTokens(
      tokenType: session.tokenType,
      accessToken: session.accessToken,
      refreshToken: session.refreshToken,
      expiresIn: session.expiresIn,
    );
    return session;
  }

  @override
  Future<void> forgotPassword(String email) async {
    await Future.delayed(const Duration(milliseconds: 300));
    // Always 204
  }

  @override
  Future<void> resetPassword(String email, String resetCode, String newPassword) async {
    await Future.delayed(const Duration(milliseconds: 400));
    if (newPassword.length < 6) {
      throw const AppApiException('A nova senha deve ter pelo menos 6 caracteres.');
    }
    _users[email] = newPassword;
  }

  @override
  Future<void> logout() async {
    await sessionStorage.clear();
  }

  @override
  Future<SteamAuthStartResponse> startSteamAuth({
    required String codeChallenge,
    bool isLink = false,
  }) async {
    await Future.delayed(const Duration(milliseconds: 200));
    final mockState = 'mock-steam-state-${DateTime.now().millisecondsSinceEpoch}';
    return SteamAuthStartResponse(
      state: mockState,
      authorizationUrl: 'https://steamcommunity.com/openid/login?openid.mode=checkid_setup&state=$mockState',
      expiresIn: 300,
    );
  }

  @override
  Future<SessionResponse> redeemSteamToken({
    required String state,
    required String code,
    required String codeVerifier,
  }) async {
    await Future.delayed(const Duration(milliseconds: 300));
    final session = SessionResponse(
      tokenType: 'Bearer',
      accessToken: 'token-opaco-steam-${DateTime.now().millisecondsSinceEpoch}',
      expiresIn: 900,
      refreshToken: 'token-renovacao-steam-${DateTime.now().millisecondsSinceEpoch}',
    );

    await sessionStorage.saveTokens(
      tokenType: session.tokenType,
      accessToken: session.accessToken,
      refreshToken: session.refreshToken,
      expiresIn: session.expiresIn,
    );
    return session;
  }

  @override
  Future<void> linkSteamAccount({
    required String state,
    required String code,
    required String codeVerifier,
  }) async {
    await Future.delayed(const Duration(milliseconds: 300));
    // Check if error simulation
    if (code == 'conflict') {
      throw const AppApiException('Conta Steam já associada a outra conta.', statusCode: 409);
    }
  }
}
