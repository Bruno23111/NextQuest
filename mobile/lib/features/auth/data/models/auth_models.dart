class Credentials {
  final String email;
  final String password;

  const Credentials({required this.email, required this.password});

  Map<String, dynamic> toJson() => {
    'email': email,
    'password': password,
  };
}

class SessionResponse {
  final String tokenType;
  final String accessToken;
  final int expiresIn;
  final String refreshToken;

  const SessionResponse({
    required this.tokenType,
    required this.accessToken,
    required this.expiresIn,
    required this.refreshToken,
  });

  factory SessionResponse.fromJson(Map<String, dynamic> json) {
    return SessionResponse(
      tokenType: json['tokenType'] as String? ?? 'Bearer',
      accessToken: json['accessToken'] as String,
      expiresIn: (json['expiresIn'] as num?)?.toInt() ?? 900,
      refreshToken: json['refreshToken'] as String,
    );
  }

  Map<String, dynamic> toJson() => {
    'tokenType': tokenType,
    'accessToken': accessToken,
    'expiresIn': expiresIn,
    'refreshToken': refreshToken,
  };
}

class ResetPasswordRequest {
  final String email;
  final String resetCode;
  final String newPassword;

  const ResetPasswordRequest({
    required this.email,
    required this.resetCode,
    required this.newPassword,
  });

  Map<String, dynamic> toJson() => {
    'email': email,
    'resetCode': resetCode,
    'newPassword': newPassword,
  };
}

class SteamAuthStartResponse {
  final String state;
  final String authorizationUrl;
  final int expiresIn;

  const SteamAuthStartResponse({
    required this.state,
    required this.authorizationUrl,
    required this.expiresIn,
  });

  factory SteamAuthStartResponse.fromJson(Map<String, dynamic> json) {
    return SteamAuthStartResponse(
      state: json['state'] as String,
      authorizationUrl: json['authorizationUrl'] as String,
      expiresIn: (json['expiresIn'] as num?)?.toInt() ?? 300,
    );
  }
}

class RedeemSteamAuth {
  final String state;
  final String code;
  final String codeVerifier;

  const RedeemSteamAuth({
    required this.state,
    required this.code,
    required this.codeVerifier,
  });

  Map<String, dynamic> toJson() => {
    'state': state,
    'code': code,
    'codeVerifier': codeVerifier,
  };
}
