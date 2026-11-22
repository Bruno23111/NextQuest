import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:games_backlog/core/constants/app_strings.dart';
import 'package:games_backlog/core/models/api_error.dart';
import 'package:games_backlog/features/backlog/data/backlog_repository_mock.dart';
import 'package:games_backlog/features/catalog/data/catalog_repository_mock.dart';
import 'package:games_backlog/features/catalog/presentation/controllers/catalog_controller.dart';
import 'package:games_backlog/features/catalog/presentation/screens/catalog_search_screen.dart';

void main() {
  group('Catalog RAWG Tests', () {
    late BacklogRepositoryMock backlogRepo;
    late CatalogRepositoryMock catalogRepo;

    setUp(() {
      backlogRepo = BacklogRepositoryMock(seedGames: []);
      catalogRepo = CatalogRepositoryMock(backlogRepository: backlogRepo);
    });

    test('Search games returns matching catalog results', () async {
      final results = await catalogRepo.searchGames('Witcher');
      expect(results.items.isNotEmpty, isTrue);
      expect(results.items.first.title, contains('The Witcher'));
      expect(results.items.first.platforms.isNotEmpty, isTrue);
    });

    test('Import game adds entry to backlog with platform and rawgId', () async {
      final imported = await catalogRepo.importGame(3328, 4); // Witcher on PC
      expect(imported.title, contains('The Witcher'));
      expect(imported.platform, equals('PC'));
      expect(imported.rawgId, equals(3328));
      expect(imported.isImportedFromRawg, isTrue);

      final backlog = await backlogRepo.getBacklog();
      expect(backlog.items.any((g) => g.rawgId == 3328), isTrue);
    });

    test('Importing duplicate game throws 409 Conflict', () async {
      await catalogRepo.importGame(3328, 4); // first import

      expect(
        () => catalogRepo.importGame(3328, 4), // duplicate import
        throwsA(isA<AppApiException>().having((e) => e.statusCode, 'statusCode', 409)),
      );
    });

    test('Simulating unavailable catalog throws 503 Service Unavailable', () async {
      expect(
        () => catalogRepo.searchGames('503'),
        throwsA(isA<AppApiException>().having((e) => e.statusCode, 'statusCode', 503)),
      );
    });

    testWidgets('CatalogSearchScreen displays RAWG attribution credit', (tester) async {
      final container = ProviderContainer(
        overrides: [
          catalogRepositoryProvider.overrideWithValue(catalogRepo),
        ],
      );
      addTearDown(container.dispose);

      await tester.pumpWidget(
        UncontrolledProviderScope(
          container: container,
          child: const MaterialApp(
            home: CatalogSearchScreen(),
          ),
        ),
      );

      await tester.pumpAndSettle();

      expect(find.text(AppStrings.rawgCredit), findsOneWidget);
    });

    testWidgets('CatalogSearchScreen displays 409 conflict error banner', (tester) async {
      final container = ProviderContainer(
        overrides: [
          catalogRepositoryProvider.overrideWithValue(catalogRepo),
        ],
      );
      addTearDown(container.dispose);

      await tester.pumpWidget(
        UncontrolledProviderScope(
          container: container,
          child: const MaterialApp(
            home: CatalogSearchScreen(),
          ),
        ),
      );

      await tester.pumpAndSettle();

      // Trigger conflict error manually in state
      container.read(catalogControllerProvider.notifier).state =
          container.read(catalogControllerProvider).copyWith(
                errorMessage: 'Jogo já importado para esta plataforma.',
                errorStatusCode: 409,
              );

      await tester.pump();

      expect(find.text('Jogo já importado para esta plataforma.'), findsOneWidget);
    });

    testWidgets('CatalogSearchScreen displays 503 unavailable error banner with retry', (tester) async {
      final container = ProviderContainer(
        overrides: [
          catalogRepositoryProvider.overrideWithValue(catalogRepo),
        ],
      );
      addTearDown(container.dispose);

      await tester.pumpWidget(
        UncontrolledProviderScope(
          container: container,
          child: const MaterialApp(
            home: CatalogSearchScreen(),
          ),
        ),
      );

      await tester.pumpAndSettle();

      // Trigger 503 error
      container.read(catalogControllerProvider.notifier).state =
          container.read(catalogControllerProvider).copyWith(
                errorMessage: 'Catálogo indisponível. Tente novamente.',
                errorStatusCode: 503,
              );

      await tester.pump();

      expect(find.text('Catálogo indisponível. Tente novamente.'), findsWidgets);
      expect(find.text('Tentar novamente'), findsWidgets);
    });
  });
}
