import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:games_backlog/core/constants/app_strings.dart';
import 'package:games_backlog/features/shell/presentation/main_shell.dart';
import 'package:games_backlog/features/shell/presentation/widgets/psn_bottom_nav_bar.dart';
import 'package:go_router/go_router.dart';

void main() {
  group('Responsive Layout Tests', () {
    Widget createShellTestApp({required Size screenSize}) {
      final router = GoRouter(
        initialLocation: '/library',
        routes: [
          StatefulShellRoute.indexedStack(
            builder: (context, state, navigationShell) =>
                MainShell(navigationShell: navigationShell),
            branches: [
              StatefulShellBranch(
                routes: [
                  GoRoute(
                    path: '/library',
                    builder: (context, state) => const Scaffold(body: Text('Library Content')),
                  ),
                ],
              ),
              StatefulShellBranch(
                routes: [
                  GoRoute(
                    path: '/search',
                    builder: (context, state) => const Scaffold(body: Text('Search Content')),
                  ),
                ],
              ),
              StatefulShellBranch(
                routes: [
                  GoRoute(
                    path: '/account',
                    builder: (context, state) => const Scaffold(body: Text('Account Content')),
                  ),
                ],
              ),
            ],
          ),
        ],
      );

      return MediaQuery(
        data: MediaQueryData(size: screenSize),
        child: MaterialApp.router(
          routerConfig: router,
        ),
      );
    }

    testWidgets('Compact/Mobile screen (< 720px) uses PSN-style Bottom NavigationBar', (tester) async {
      tester.view.physicalSize = const Size(400, 800);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.resetPhysicalSize);

      await tester.pumpWidget(createShellTestApp(screenSize: const Size(400, 800)));
      await tester.pumpAndSettle();

      expect(find.byType(PsnBottomNavBar), findsOneWidget);
      expect(find.byType(NavigationRail), findsNothing);
      expect(find.text(AppStrings.library), findsOneWidget);
    });

    testWidgets('Wide/Desktop screen (>= 720px) uses Side NavigationRail', (tester) async {
      tester.view.physicalSize = const Size(1200, 800);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.resetPhysicalSize);

      await tester.pumpWidget(createShellTestApp(screenSize: const Size(1200, 800)));
      await tester.pumpAndSettle();

      expect(find.byType(NavigationRail), findsOneWidget);
      expect(find.byType(NavigationBar), findsNothing);
      expect(find.text(AppStrings.library), findsOneWidget);
      expect(find.text(AppStrings.search), findsOneWidget);
      expect(find.text(AppStrings.account), findsOneWidget);
    });
  });
}
