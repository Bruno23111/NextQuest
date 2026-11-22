import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:games_backlog/core/constants/app_strings.dart';
import 'package:games_backlog/core/models/game_status.dart';
import 'package:games_backlog/features/backlog/data/backlog_repository_mock.dart';
import 'package:games_backlog/features/backlog/data/models/backlog_models.dart';
import 'package:games_backlog/features/backlog/presentation/controllers/backlog_controller.dart';
import 'package:games_backlog/features/backlog/presentation/screens/backlog_screen.dart';
import 'package:games_backlog/features/backlog/presentation/screens/game_detail_screen.dart';
import 'package:games_backlog/features/backlog/presentation/widgets/game_card.dart';
import 'package:games_backlog/features/backlog/presentation/widgets/playing_now_card.dart';

void main() {
  group('Backlog Tests', () {
    test('Filter by status returns only games with matching status', () async {
      final repo = BacklogRepositoryMock();
      final allGames = await repo.getBacklog();
      expect(allGames.items.isNotEmpty, isTrue);

      final playingGames = await repo.getBacklog(status: GameStatus.playing);
      for (final g in playingGames.items) {
        expect(g.status, equals(GameStatus.playing));
      }

      final completedGames = await repo.getBacklog(status: GameStatus.completed);
      for (final g in completedGames.items) {
        expect(g.status, equals(GameStatus.completed));
      }
    });

    test('Add manual game sets default status planned', () async {
      final repo = BacklogRepositoryMock(seedGames: []);
      final newGame = await repo.createGame('Novo Jogo Indie', 'PC');
      expect(newGame.title, equals('Novo Jogo Indie'));
      expect(newGame.platform, equals('PC'));
      expect(newGame.status, equals(GameStatus.planned));
      expect(newGame.isImportedFromRawg, isFalse);

      final list = await repo.getBacklog();
      expect(list.items.length, equals(1));
    });

    test('Update game status changes status successfully', () async {
      final repo = BacklogRepositoryMock();
      final list = await repo.getBacklog();
      final firstGame = list.items.first;

      final updated = await repo.updateGame(firstGame.id, status: GameStatus.completed);
      expect(updated.status, equals(GameStatus.completed));

      final fetched = await repo.getGameById(firstGame.id);
      expect(fetched.status, equals(GameStatus.completed));
    });

    testWidgets('Empty backlog displays empty state with action buttons', (tester) async {
      final emptyRepo = BacklogRepositoryMock(seedGames: []);
      final container = ProviderContainer(
        overrides: [
          backlogRepositoryProvider.overrideWithValue(emptyRepo),
        ],
      );
      addTearDown(container.dispose);

      await tester.pumpWidget(
        UncontrolledProviderScope(
          container: container,
          child: const MaterialApp(
            home: BacklogScreen(),
          ),
        ),
      );

      await tester.pumpAndSettle();

      expect(find.text('Sua biblioteca ainda está vazia.'), findsOneWidget);
      expect(find.text('Adicionar manual'), findsOneWidget);
      expect(find.text('Buscar no Catálogo'), findsOneWidget);
    });

    testWidgets('Backlog with playing game displays Jogando Agora card', (tester) async {
      final repo = BacklogRepositoryMock();
      final container = ProviderContainer(
        overrides: [
          backlogRepositoryProvider.overrideWithValue(repo),
        ],
      );
      addTearDown(container.dispose);

      await tester.pumpWidget(
        UncontrolledProviderScope(
          container: container,
          child: const MaterialApp(
            home: BacklogScreen(),
          ),
        ),
      );

      await tester.pumpAndSettle();

      expect(find.byType(PlayingNowCard), findsOneWidget);
      expect(find.text(AppStrings.playingNow), findsOneWidget);
      expect(find.descendant(of: find.byType(PlayingNowCard), matching: find.text('Cyberpunk 2077')), findsWidgets);
    });

    testWidgets('Status filters remain usable in a narrow library', (tester) async {
      tester.view.physicalSize = const Size(320, 700);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);

      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            backlogRepositoryProvider.overrideWithValue(BacklogRepositoryMock()),
          ],
          child: const MaterialApp(home: BacklogScreen()),
        ),
      );
      await tester.pumpAndSettle();

      final completed = find.widgetWithText(ChoiceChip, AppStrings.statusCompleted);
      await tester.ensureVisible(completed);
      await tester.pumpAndSettle();
      await tester.tap(completed);
      await tester.pumpAndSettle();

      expect(find.byType(PlayingNowCard), findsNothing);
      expect(find.byType(GameCard), findsOneWidget);
      expect(find.text('The Witcher 3: Wild Hunt'), findsOneWidget);

      await tester.tap(find.text('Em andamento'));
      await tester.pumpAndSettle();

      expect(find.byType(PlayingNowCard), findsOneWidget);
      expect(find.byType(GameCard), findsOneWidget);
      expect(find.text('The Witcher 3: Wild Hunt'), findsNothing);
      expect(tester.takeException(), isNull);
    });

    testWidgets('Game detail allows changing game status', (tester) async {
      final repo = BacklogRepositoryMock();
      final testGame = BacklogGame(
        id: 'test-game-123',
        title: 'Jogo Teste',
        platform: 'PlayStation 5',
        status: GameStatus.planned,
        createdAt: DateTime.now(),
      );

      final container = ProviderContainer(
        overrides: [
          backlogRepositoryProvider.overrideWithValue(repo),
        ],
      );
      addTearDown(container.dispose);

      await tester.pumpWidget(
        UncontrolledProviderScope(
          container: container,
          child: MaterialApp(
            home: GameDetailScreen(
              gameId: testGame.id,
              initialGame: testGame,
            ),
          ),
        ),
      );

      await tester.pumpAndSettle();

      expect(find.text('Jogo Teste'), findsWidgets);
      expect(find.text('Status na biblioteca'), findsOneWidget);
      expect(find.text(AppStrings.statusPlaying), findsOneWidget);
      expect(find.text(AppStrings.statusCompleted), findsOneWidget);
      expect(find.text(AppStrings.statusDropped), findsOneWidget);
    });
  });
}
