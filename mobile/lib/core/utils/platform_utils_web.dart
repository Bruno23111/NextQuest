import 'package:web/web.dart' as web;

class PlatformUtils {
  PlatformUtils._();

  static Future<bool> openExternalUrl(
    String urlString, {
    bool sameTabOnWeb = false,
  }) async {
    try {
      if (sameTabOnWeb) {
        web.window.location.href = urlString;
      } else {
        web.window.open(urlString, '_blank');
      }
      return true;
    } catch (_) {
      return false;
    }
  }
}
