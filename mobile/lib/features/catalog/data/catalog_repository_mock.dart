import 'package:games_backlog/core/models/api_error.dart';
import 'package:games_backlog/core/models/game_status.dart';
import 'package:games_backlog/core/models/paginated_result.dart';
import 'package:games_backlog/features/backlog/data/backlog_repository_mock.dart';
import 'package:games_backlog/features/backlog/data/models/backlog_models.dart';
import 'catalog_repository.dart';
import 'models/catalog_models.dart';

class CatalogRepositoryMock implements CatalogRepository {
  final BacklogRepositoryMock? backlogRepository;

  final List<CatalogGame> _catalogGames = [
    // Contract example from specs/examples/catalog.json
    const CatalogGame(
      rawgId: 9,
      title: 'Jogo de exemplo',
      coverUrl: null,
      platforms: [
        CatalogPlatform(id: 42, name: 'PC'),
      ],
    ),
    const CatalogGame(
      rawgId: 3328,
      title: 'The Witcher 3: Wild Hunt',
      coverUrl: 'https://media.rawg.io/media/games/618/618c2031a070922302a4fce40ea167a6.jpg',
      platforms: [
        CatalogPlatform(id: 4, name: 'PC'),
        CatalogPlatform(id: 187, name: 'PlayStation 5'),
        CatalogPlatform(id: 186, name: 'Xbox Series X'),
        CatalogPlatform(id: 7, name: 'Nintendo Switch'),
      ],
    ),
    const CatalogGame(
      rawgId: 58175,
      title: 'God of War Ragnarök',
      coverUrl: 'https://media.rawg.io/media/games/106/10689e47e33a737e76bfa2a546b00347.jpg',
      platforms: [
        CatalogPlatform(id: 187, name: 'PlayStation 5'),
        CatalogPlatform(id: 18, name: 'PlayStation 4'),
      ],
    ),
    const CatalogGame(
      rawgId: 3272,
      title: 'Elden Ring',
      coverUrl: 'https://media.rawg.io/media/games/b29/b2962c0733ba80623684f49c57de4f35.jpg',
      platforms: [
        CatalogPlatform(id: 4, name: 'PC'),
        CatalogPlatform(id: 187, name: 'PlayStation 5'),
        CatalogPlatform(id: 186, name: 'Xbox Series X'),
      ],
    ),
    const CatalogGame(
      rawgId: 452634,
      title: 'Hades II',
      coverUrl: 'https://media.rawg.io/media/games/1f4/1f4dd0154e035f5087f1b2b58a1dd9a4.jpg',
      platforms: [
        CatalogPlatform(id: 4, name: 'PC'),
      ],
    ),
  ];

  CatalogRepositoryMock({this.backlogRepository});

  @override
  Future<PaginatedResult<CatalogGame>> popularGames({int page = 1}) async {
    await Future.delayed(const Duration(milliseconds: 250));
    const pageSize = 40;
    final startIndex = (page - 1) * pageSize;
    if (startIndex >= _catalogGames.length) {
      return PaginatedResult(items: [], page: page, pageSize: pageSize, hasMore: false);
    }
    final endIndex = (startIndex + pageSize).clamp(0, _catalogGames.length);
    return PaginatedResult(
      items: _catalogGames.sublist(startIndex, endIndex),
      page: page,
      pageSize: pageSize,
      hasMore: endIndex < _catalogGames.length,
    );
  }

  @override
  Future<PaginatedResult<CatalogGame>> searchGames(String query, {int page = 1}) async {
    await Future.delayed(const Duration(milliseconds: 300));

    // Simulation of 503 unavailable
    if (query.trim().toLowerCase() == '503' || query.trim().toLowerCase() == 'erro') {
      throw const AppApiException('Catálogo indisponível. Tente novamente.', statusCode: 503);
    }

    final q = query.trim().toLowerCase();
    final filtered = _catalogGames
        .where((g) => g.title.toLowerCase().contains(q))
        .toList();

    const pageSize = 20;
    final startIndex = (page - 1) * pageSize;
    if (startIndex >= filtered.length) {
      return PaginatedResult(
        items: [],
        page: page,
        pageSize: pageSize,
        hasMore: false,
      );
    }

    final endIndex = (startIndex + pageSize) > filtered.length
        ? filtered.length
        : (startIndex + pageSize);

    return PaginatedResult(
      items: filtered.sublist(startIndex, endIndex),
      page: page,
      pageSize: pageSize,
      hasMore: endIndex < filtered.length,
    );
  }

  @override
  Future<BacklogGame> importGame(int rawgId, int platformId) async {
    await Future.delayed(const Duration(milliseconds: 350));

    // Simulate 503 if rawgId == 503
    if (rawgId == 503) {
      throw const AppApiException('Catálogo indisponível. Tente novamente.', statusCode: 503);
    }

    // Check duplicate in backlog
    if (backlogRepository != null && backlogRepository!.containsImport(rawgId, platformId)) {
      throw const AppApiException('Jogo já importado para esta plataforma.', statusCode: 409);
    }

    // Find catalog game
    final catalogGame = _catalogGames.cast<CatalogGame?>().firstWhere(
          (g) => g?.rawgId == rawgId,
          orElse: () => null,
        );

    final platform = catalogGame?.platforms.cast<CatalogPlatform?>().firstWhere(
          (p) => p?.id == platformId,
          orElse: () => null,
        );

    final title = catalogGame?.title ?? 'Jogo importado';
    final platformName = platform?.name ?? 'PC';

    final importedBacklogGame = BacklogGame(
      id: 'imported-${DateTime.now().millisecondsSinceEpoch}',
      title: title,
      platform: platformName,
      status: GameStatus.planned,
      rawgId: rawgId,
      platformId: platformId,
      coverUrl: catalogGame?.coverUrl,
      createdAt: DateTime.now(),
    );

    backlogRepository?.addImportedGame(importedBacklogGame);
    return importedBacklogGame;
  }
}
