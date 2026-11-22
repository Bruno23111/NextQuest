import 'package:shared_preferences/shared_preferences.dart';

class PendingSteamAuth {
  final String state;
  final String codeVerifier;
  final bool isLink;

  const PendingSteamAuth({
    required this.state,
    required this.codeVerifier,
    required this.isLink,
  });
}

abstract class SessionStorage {
  Future<void> saveTokens({
    required String tokenType,
    required String accessToken,
    required String refreshToken,
    required int expiresIn,
  });

  Future<String?> getAccessToken();
  Future<String?> getRefreshToken();
  Future<String?> getTokenType();
  Future<void> clear();
  Future<bool> hasSession();

  Future<void> savePendingSteamAuth(PendingSteamAuth pending);
  Future<PendingSteamAuth?> getPendingSteamAuth();
  Future<void> clearPendingSteamAuth();
}

class SharedPreferencesSessionStorage implements SessionStorage {
  static const _keyAccessToken = 'auth_access_token';
  static const _keyRefreshToken = 'auth_refresh_token';
  static const _keyTokenType = 'auth_token_type';
  static const _keyExpiresAt = 'auth_expires_at';
  static const _keySteamState = 'steam_pending_state';
  static const _keySteamVerifier = 'steam_pending_verifier';
  static const _keySteamIsLink = 'steam_pending_is_link';

  final SharedPreferences _prefs;

  SharedPreferencesSessionStorage(this._prefs);

  @override
  Future<void> saveTokens({
    required String tokenType,
    required String accessToken,
    required String refreshToken,
    required int expiresIn,
  }) async {
    final expiresAt = DateTime.now().millisecondsSinceEpoch + (expiresIn * 1000);
    await _prefs.setString(_keyTokenType, tokenType);
    await _prefs.setString(_keyAccessToken, accessToken);
    await _prefs.setString(_keyRefreshToken, refreshToken);
    await _prefs.setInt(_keyExpiresAt, expiresAt);
  }

  @override
  Future<String?> getAccessToken() async {
    return _prefs.getString(_keyAccessToken);
  }

  @override
  Future<String?> getRefreshToken() async {
    return _prefs.getString(_keyRefreshToken);
  }

  @override
  Future<String?> getTokenType() async {
    return _prefs.getString(_keyTokenType) ?? 'Bearer';
  }

  @override
  Future<void> clear() async {
    await _prefs.remove(_keyAccessToken);
    await _prefs.remove(_keyRefreshToken);
    await _prefs.remove(_keyTokenType);
    await _prefs.remove(_keyExpiresAt);
  }

  @override
  Future<bool> hasSession() async {
    final token = _prefs.getString(_keyAccessToken);
    return token != null && token.isNotEmpty;
  }

  @override
  Future<void> savePendingSteamAuth(PendingSteamAuth pending) async {
    await _prefs.setString(_keySteamState, pending.state);
    await _prefs.setString(_keySteamVerifier, pending.codeVerifier);
    await _prefs.setBool(_keySteamIsLink, pending.isLink);
  }

  @override
  Future<PendingSteamAuth?> getPendingSteamAuth() async {
    final state = _prefs.getString(_keySteamState);
    final verifier = _prefs.getString(_keySteamVerifier);
    if (state == null || verifier == null) return null;
    return PendingSteamAuth(
      state: state,
      codeVerifier: verifier,
      isLink: _prefs.getBool(_keySteamIsLink) ?? false,
    );
  }

  @override
  Future<void> clearPendingSteamAuth() async {
    await _prefs.remove(_keySteamState);
    await _prefs.remove(_keySteamVerifier);
    await _prefs.remove(_keySteamIsLink);
  }
}

/// In-memory implementation useful for tests and pure sandbox runs
class InMemorySessionStorage implements SessionStorage {
  String? _accessToken;
  String? _refreshToken;
  String? _tokenType;
  PendingSteamAuth? _pendingSteamAuth;

  @override
  Future<void> clear() async {
    _accessToken = null;
    _refreshToken = null;
    _tokenType = null;
  }

  @override
  Future<String?> getAccessToken() async => _accessToken;

  @override
  Future<String?> getRefreshToken() async => _refreshToken;

  @override
  Future<String?> getTokenType() async => _tokenType ?? 'Bearer';

  @override
  Future<bool> hasSession() async => _accessToken != null && _accessToken!.isNotEmpty;

  @override
  Future<void> saveTokens({
    required String tokenType,
    required String accessToken,
    required String refreshToken,
    required int expiresIn,
  }) async {
    _tokenType = tokenType;
    _accessToken = accessToken;
    _refreshToken = refreshToken;
  }

  @override
  Future<void> savePendingSteamAuth(PendingSteamAuth pending) async {
    _pendingSteamAuth = pending;
  }

  @override
  Future<PendingSteamAuth?> getPendingSteamAuth() async => _pendingSteamAuth;

  @override
  Future<void> clearPendingSteamAuth() async {
    _pendingSteamAuth = null;
  }
}
