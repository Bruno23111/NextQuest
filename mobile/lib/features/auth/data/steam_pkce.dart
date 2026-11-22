import 'dart:convert';
import 'dart:math';
import 'package:crypto/crypto.dart';

class SteamPkce {
  final String codeVerifier;
  final String codeChallenge;

  const SteamPkce({
    required this.codeVerifier,
    required this.codeChallenge,
  });

  /// Generates a cryptographically secure 32-byte codeVerifier and its SHA-256 codeChallenge.
  /// Both encoded in Base64 URL without padding.
  factory SteamPkce.generate() {
    final random = Random.secure();
    final bytes = List<int>.generate(32, (_) => random.nextInt(256));
    final verifier = base64Url.encode(bytes).replaceAll('=', '');

    final hash = sha256.convert(utf8.encode(verifier));
    final challenge = base64Url.encode(hash.bytes).replaceAll('=', '');

    return SteamPkce(
      codeVerifier: verifier,
      codeChallenge: challenge,
    );
  }
}
