import 'models/auth_models.dart';

abstract class AuthRepository {
  Future<void> register(String email, String password);
  Future<String> confirmEmail(String userId, String code);
  Future<void> resendConfirmationEmail(String email);
  Future<SessionResponse> login(String email, String password);
  Future<SessionResponse> refresh(String refreshToken);
  Future<void> forgotPassword(String email);
  Future<void> resetPassword(String email, String resetCode, String newPassword);
  Future<void> logout();

  // Steam Auth
  Future<SteamAuthStartResponse> startSteamAuth({required String codeChallenge, bool isLink = false});
  Future<SessionResponse> redeemSteamToken({required String state, required String code, required String codeVerifier});
  Future<void> linkSteamAccount({required String state, required String code, required String codeVerifier});
}
