import 'package:games_backlog/core/network/api_client.dart';
import 'package:games_backlog/core/storage/session_storage.dart';
import 'auth_repository.dart';
import 'models/auth_models.dart';

class AuthRepositoryHttp implements AuthRepository {
  final ApiClient apiClient;
  final SessionStorage sessionStorage;

  AuthRepositoryHttp({
    required this.apiClient,
    required this.sessionStorage,
  });

  @override
  Future<void> register(String email, String password) async {
    try {
      await apiClient.dio.post(
        '/api/v1/auth/register',
        data: Credentials(email: email, password: password).toJson(),
      );
    } catch (e) {
      throw ApiClient.handleException(e);
    }
  }

  @override
  Future<String> confirmEmail(String userId, String code) async {
    try {
      final response = await apiClient.dio.get<String>(
        '/api/v1/auth/confirmEmail',
        queryParameters: {'userId': userId, 'code': code},
      );
      return response.data ?? 'E-mail confirmado com sucesso!';
    } catch (e) {
      throw ApiClient.handleException(e);
    }
  }

  @override
  Future<void> resendConfirmationEmail(String email) async {
    try {
      await apiClient.dio.post(
        '/api/v1/auth/resendConfirmationEmail',
        data: {'email': email},
      );
    } catch (e) {
      throw ApiClient.handleException(e);
    }
  }

  @override
  Future<SessionResponse> login(String email, String password) async {
    try {
      final response = await apiClient.dio.post(
        '/api/v1/auth/login',
        data: Credentials(email: email, password: password).toJson(),
      );

      final session = SessionResponse.fromJson(response.data as Map<String, dynamic>);
      await sessionStorage.saveTokens(
        tokenType: session.tokenType,
        accessToken: session.accessToken,
        refreshToken: session.refreshToken,
        expiresIn: session.expiresIn,
      );
      return session;
    } catch (e) {
      throw ApiClient.handleException(e);
    }
  }

  @override
  Future<SessionResponse> refresh(String refreshToken) async {
    try {
      final response = await apiClient.dio.post(
        '/api/v1/auth/refresh',
        data: {'refreshToken': refreshToken},
      );
      final session = SessionResponse.fromJson(response.data as Map<String, dynamic>);
      await sessionStorage.saveTokens(
        tokenType: session.tokenType,
        accessToken: session.accessToken,
        refreshToken: session.refreshToken,
        expiresIn: session.expiresIn,
      );
      return session;
    } catch (e) {
      throw ApiClient.handleException(e);
    }
  }

  @override
  Future<void> forgotPassword(String email) async {
    try {
      await apiClient.dio.post(
        '/api/v1/auth/forgotPassword',
        data: {'email': email},
      );
    } catch (e) {
      throw ApiClient.handleException(e);
    }
  }

  @override
  Future<void> resetPassword(String email, String resetCode, String newPassword) async {
    try {
      await apiClient.dio.post(
        '/api/v1/auth/resetPassword',
        data: ResetPasswordRequest(
          email: email,
          resetCode: resetCode,
          newPassword: newPassword,
        ).toJson(),
      );
    } catch (e) {
      throw ApiClient.handleException(e);
    }
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
    try {
      final endpoint = isLink ? '/api/v1/auth/steam/link/start' : '/api/v1/auth/steam/start';
      final response = await apiClient.dio.post(
        endpoint,
        data: {'codeChallenge': codeChallenge},
      );
      return SteamAuthStartResponse.fromJson(response.data as Map<String, dynamic>);
    } catch (e) {
      throw ApiClient.handleException(e);
    }
  }

  @override
  Future<SessionResponse> redeemSteamToken({
    required String state,
    required String code,
    required String codeVerifier,
  }) async {
    try {
      final response = await apiClient.dio.post(
        '/api/v1/auth/steam/token',
        data: RedeemSteamAuth(
          state: state,
          code: code,
          codeVerifier: codeVerifier,
        ).toJson(),
      );

      final session = SessionResponse.fromJson(response.data as Map<String, dynamic>);
      await sessionStorage.saveTokens(
        tokenType: session.tokenType,
        accessToken: session.accessToken,
        refreshToken: session.refreshToken,
        expiresIn: session.expiresIn,
      );
      return session;
    } catch (e) {
      throw ApiClient.handleException(e);
    }
  }

  @override
  Future<void> linkSteamAccount({
    required String state,
    required String code,
    required String codeVerifier,
  }) async {
    try {
      await apiClient.dio.post(
        '/api/v1/auth/steam/link',
        data: RedeemSteamAuth(
          state: state,
          code: code,
          codeVerifier: codeVerifier,
        ).toJson(),
      );
    } catch (e) {
      throw ApiClient.handleException(e);
    }
  }
}
