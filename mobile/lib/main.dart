import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'core/constants/app_strings.dart';
import 'core/storage/session_storage.dart';
import 'core/theme/app_theme.dart';
import 'features/auth/presentation/controllers/auth_controller.dart';
import 'routes/app_router.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // Initialize SharedPreferences for Web and Android session storage
  SessionStorage sessionStorage;
  try {
    final prefs = await SharedPreferences.getInstance();
    sessionStorage = SharedPreferencesSessionStorage(prefs);
  } catch (_) {
    sessionStorage = InMemorySessionStorage();
  }

  runApp(
    ProviderScope(
      overrides: [
        sessionStorageProvider.overrideWithValue(sessionStorage),
      ],
      child: const GamesBacklogApp(),
    ),
  );
}

class GamesBacklogApp extends ConsumerWidget {
  const GamesBacklogApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final router = ref.watch(routerProvider);

    return MaterialApp.router(
      title: AppStrings.appTitle,
      debugShowCheckedModeBanner: false,
      theme: AppTheme.darkTheme,
      routerConfig: router,
    );
  }
}
