import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:games_backlog/core/storage/session_storage.dart';
import 'package:games_backlog/features/auth/data/auth_repository_mock.dart';
import 'package:games_backlog/features/auth/data/steam_pkce.dart';
import 'package:games_backlog/features/auth/presentation/controllers/auth_controller.dart';
import 'package:games_backlog/features/auth/presentation/screens/login_screen.dart';

void main() {
  group('Auth Tests', () {
    late InMemorySessionStorage storage;
    late AuthRepositoryMock repository;

    setUp(() {
      storage = InMemorySessionStorage();
      repository = AuthRepositoryMock(sessionStorage: storage);
    });

    test('Login success with mock contract credentials saves session', () async {
      final session = await repository.login('jogadora@example.org', 'senha-de-exemplo');
      expect(session.tokenType, equals('Bearer'));
      expect(session.accessToken, contains('token-opaco-de-exemplo'));
      expect(await storage.hasSession(), isTrue);
    });

    test('Login with unconfirmed email throws 401 error', () async {
      expect(
        () => repository.login('unconfirmed@example.org', 'senha-de-exemplo'),
        throwsA(predicate((e) => e.toString().contains('Credenciais inválidas') || e.toString().contains('401'))),
      );
    });

    test('Token refresh updates stored session', () async {
      final session = await repository.refresh('token-de-renovacao-de-exemplo');
      expect(session.accessToken, contains('token-opaco-de-exemplo-renovado'));
      expect(await storage.getAccessToken(), contains('token-opaco-de-exemplo-renovado'));
    });

    test('Logout clears session storage', () async {
      await repository.login('jogadora@example.org', 'senha-de-exemplo');
      expect(await storage.hasSession(), isTrue);
      await repository.logout();
      expect(await storage.hasSession(), isFalse);
    });

    test('Steam PKCE generates valid verifier and challenge', () {
      final pkce = SteamPkce.generate();
      expect(pkce.codeVerifier.isNotEmpty, isTrue);
      expect(pkce.codeChallenge.isNotEmpty, isTrue);
      expect(pkce.codeVerifier.contains('='), isFalse);
      expect(pkce.codeChallenge.contains('='), isFalse);
    });

    test('Steam flow start and redeem tokens', () async {
      final pkce = SteamPkce.generate();
      final start = await repository.startSteamAuth(codeChallenge: pkce.codeChallenge);
      expect(start.authorizationUrl, contains('openid'));
      expect(start.state.isNotEmpty, isTrue);

      final session = await repository.redeemSteamToken(
        state: start.state,
        code: 'mock-code',
        codeVerifier: pkce.codeVerifier,
      );
      expect(session.accessToken, contains('token-opaco-steam'));
      expect(await storage.hasSession(), isTrue);
    });

    testWidgets('LoginScreen renders email, password fields, submit button, steam button and demo banner', (tester) async {
      final container = ProviderContainer(
        overrides: [
          sessionStorageProvider.overrideWithValue(storage),
          authRepositoryProvider.overrideWithValue(repository),
        ],
      );
      addTearDown(container.dispose);

      await tester.pumpWidget(
        UncontrolledProviderScope(
          container: container,
          child: const MaterialApp(
            home: LoginScreen(),
          ),
        ),
      );

      expect(find.text('NextQuest'), findsOneWidget);
      expect(find.byType(TextFormField), findsNWidgets(2));
      expect(find.widgetWithText(ElevatedButton, 'Entrar'), findsOneWidget);
      expect(find.text('Entrar com Steam'), findsOneWidget);
      expect(find.text('Criar conta'), findsOneWidget);
      expect(find.text('Esqueci minha senha'), findsOneWidget);
    });
  });
}
