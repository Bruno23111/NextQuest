import 'package:url_launcher/url_launcher.dart';

class PlatformUtils {
  PlatformUtils._();

  static Future<bool> openExternalUrl(
    String urlString, {
    bool sameTabOnWeb = false,
  }) async {
    try {
      final uri = Uri.parse(urlString);
      return await launchUrl(
        uri,
        mode: LaunchMode.externalApplication,
      );
    } catch (_) {
      return false;
    }
  }
}
