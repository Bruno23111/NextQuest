import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:games_backlog/features/auth/presentation/screens/steam_callback_screen.dart';
import 'package:go_router/go_router.dart';
import 'package:games_backlog/features/auth/presentation/controllers/auth_controller.dart';
import 'package:games_backlog/features/auth/presentation/screens/forgot_password_screen.dart';
import 'package:games_backlog/features/auth/presentation/screens/login_screen.dart';
import 'package:games_backlog/features/auth/presentation/screens/pending_confirmation_screen.dart';
import 'package:games_backlog/features/auth/presentation/screens/register_screen.dart';
import 'package:games_backlog/features/auth/presentation/screens/reset_password_screen.dart';
import 'package:games_backlog/features/backlog/data/models/backlog_models.dart';
import 'package:games_backlog/features/backlog/presentation/screens/backlog_screen.dart';
import 'package:games_backlog/features/backlog/presentation/screens/game_detail_screen.dart';
import 'package:games_backlog/features/catalog/presentation/screens/catalog_search_screen.dart';
import 'package:games_backlog/features/profile/presentation/screens/account_screen.dart';
import 'package:games_backlog/features/profile/presentation/screens/edit_profile_screen.dart';
import 'package:games_backlog/features/steam/presentation/screens/steam_library_screen.dart';
import 'package:games_backlog/features/shell/presentation/main_shell.dart';

final routerProvider = Provider<GoRouter>((ref) {
  final authRefresh = ValueNotifier<int>(0);

  final router = GoRouter(
    refreshListenable: authRefresh,
    initialLocation: '/library',
    redirect: (context, state) {
      final authState = ref.read(authControllerProvider);
      if (!authState.isInitialized) return null;

      final isAuthRoute = state.matchedLocation.startsWith('/auth');

      if (!authState.isAuthenticated) {
        return isAuthRoute ? null : '/auth/login';
      }

      if (isAuthRoute) {
        return '/library';
      }

      return null;
    },
    routes: [
      // Auth routes
      GoRoute(
        path: '/auth/login',
        builder: (context, state) => const LoginScreen(),
      ),
      GoRoute(
        path: '/auth/register',
        builder: (context, state) => const RegisterScreen(),
      ),
      GoRoute(
        path: '/auth/pending-confirmation',
        builder: (context, state) {
          final email = state.uri.queryParameters['email'];
          return PendingConfirmationScreen(initialEmail: email);
        },
      ),
      GoRoute(
        path: '/auth/forgot-password',
        builder: (context, state) => const ForgotPasswordScreen(),
      ),
      GoRoute(
        path: '/auth/reset-password',
        builder: (context, state) {
          final email = state.uri.queryParameters['email'];
          return ResetPasswordScreen(initialEmail: email);
        },
      ),
      GoRoute(
        path: '/auth/steam/callback',
        builder: (context, state) {
          final stateParam = state.uri.queryParameters['state'];
          final code = state.uri.queryParameters['code'];
          final error = state.uri.queryParameters['error'];
          return SteamCallbackScreen(
            stateParam: stateParam,
            code: code,
            error: error,
          );
        },
      ),
      GoRoute(
        path: '/account/profile',
        builder: (context, state) => const EditProfileScreen(),
      ),

      // Main App Shell with 3 Branches: Library, Search, Account
      StatefulShellRoute.indexedStack(
        builder: (context, state, navigationShell) {
          return MainShell(navigationShell: navigationShell);
        },
        branches: [
          // Branch 1: Library
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/library',
                builder: (context, state) => const SteamLibraryScreen(),
                routes: [
                  GoRoute(
                    path: 'backlog',
                    builder: (context, state) => const BacklogScreen(),
                  ),
                  GoRoute(
                    path: ':id',
                    builder: (context, state) {
                      final id = state.pathParameters['id']!;
                      final extraGame = state.extra is BacklogGame
                          ? state.extra as BacklogGame
                          : null;
                      return GameDetailScreen(gameId: id, initialGame: extraGame);
                    },
                  ),
                ],
              ),
            ],
          ),

          // Branch 2: Catalog Search
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/search',
                builder: (context, state) => const CatalogSearchScreen(),
              ),
            ],
          ),

          // Branch 3: Account
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/account',
                builder: (context, state) => const AccountScreen(),
              ),
            ],
          ),
        ],
      ),
    ],
  );

  ref.listen<AuthState>(authControllerProvider, (_, _) {
    authRefresh.value++;
  });
  ref.onDispose(() {
    router.dispose();
    authRefresh.dispose();
  });

  return router;
});
