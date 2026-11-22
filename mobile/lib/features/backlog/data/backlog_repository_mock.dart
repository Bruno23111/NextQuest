import 'package:games_backlog/core/models/api_error.dart';
import 'package:games_backlog/core/models/game_status.dart';
import 'package:games_backlog/core/models/paginated_result.dart';

import 'backlog_repository.dart';
import 'models/backlog_models.dart';

class BacklogRepositoryMock implements BacklogRepository {
  final List<BacklogGame> _games = [];

  BacklogRepositoryMock({List<BacklogGame>? seedGames}) {
    if (seedGames != null) {
      _games.addAll(seedGames);
    } else {
      _seedDefaultData();
    }
  }

  void _seedDefaultData() {
    _games.addAll([
      BacklogGame(
        id: '11111111-1111-1111-1111-111111111111',
        title: 'Cyberpunk 2077',
        platform: 'PC',
        status: GameStatus.playing,
        rawgId: 41494,
        platformId: 4,
        coverUrl: 'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1091500/library_hero.jpg',
        createdAt: DateTime.now().subtract(const Duration(days: 2)),
      ),
      BacklogGame(
        id: '83fdb8a5-a6e9-4284-8f14-a8a749056e0d',
        title: 'Meu jogo',
        platform: 'PC',
        status: GameStatus.planned,
        rawgId: null,
        platformId: null,
        coverUrl: null,
        createdAt: DateTime.now().subtract(const Duration(days: 35)),
      ),
      BacklogGame(
        id: '22222222-2222-2222-2222-222222222222',
        title: 'The Witcher 3: Wild Hunt',
        platform: 'PlayStation 5',
        status: GameStatus.completed,
        rawgId: 3328,
        platformId: 187,
        coverUrl: 'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/292030/library_600x900.jpg',
        createdAt: DateTime.now().subtract(const Duration(days: 15)),
      ),
      BacklogGame(
        id: '33333333-3333-3333-3333-333333333333',
        title: 'Hollow Knight',
        platform: 'Nintendo Switch',
        status: GameStatus.dropped,
        rawgId: 9767,
        platformId: 7,
        coverUrl: 'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/367520/library_600x900.jpg',
        createdAt: DateTime.now().subtract(const Duration(days: 30)),
      ),
    ]);
  }

  @override
  Future<PaginatedResult<BacklogGame>> getBacklog({
    String? query,
    GameStatus? status,
    int page = 1,
  }) async {
    await Future.delayed(const Duration(milliseconds: 250));

    var filtered = List<BacklogGame>.from(_games);

    if (query != null && query.trim().isNotEmpty) {
      final q = query.trim().toLowerCase();
      filtered = filtered
          .where((g) => g.title.toLowerCase().contains(q))
          .toList();
    }

    if (status != null) {
      filtered = filtered.where((g) => g.status == status).toList();
    }

    // Sort by createdAt descending
    filtered.sort((a, b) => b.createdAt.compareTo(a.createdAt));

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

    final pageItems = filtered.sublist(startIndex, endIndex);
    final hasMore = endIndex < filtered.length;

    return PaginatedResult(
      items: pageItems,
      page: page,
      pageSize: pageSize,
      hasMore: hasMore,
    );
  }

  @override
  Future<BacklogGame> getGameById(String id) async {
    await Future.delayed(const Duration(milliseconds: 150));
    final game = _games.cast<BacklogGame?>().firstWhere(
      (g) => g?.id == id,
      orElse: () => null,
    );
    if (game == null) {
      throw const AppApiException('Jogo não encontrado.', statusCode: 404);
    }
    return game;
  }

  @override
  Future<BacklogGame> createGame(String title, String platform) async {
    await Future.delayed(const Duration(milliseconds: 300));
    if (title.trim().isEmpty) {
      throw const AppApiException(
        "'title' must not be empty.",
        statusCode: 400,
      );
    }
    if (platform.trim().isEmpty) {
      throw const AppApiException(
        "'platform' must not be empty.",
        statusCode: 400,
      );
    }

    final newGame = BacklogGame(
      id: 'mock-${DateTime.now().millisecondsSinceEpoch}',
      title: title.trim(),
      platform: platform.trim(),
      status: GameStatus
          .planned, // Spec requirement: nova entrada começa em Quero jogar
      createdAt: DateTime.now(),
    );

    _games.insert(0, newGame);
    return newGame;
  }

  @override
  Future<BacklogGame> updateGame(
    String id, {
    String? title,
    String? platform,
    GameStatus? status,
  }) async {
    await Future.delayed(const Duration(milliseconds: 250));
    final index = _games.indexWhere((g) => g.id == id);
    if (index == -1) {
      throw const AppApiException('Jogo não encontrado.', statusCode: 404);
    }

    final current = _games[index];
    final updated = current.copyWith(
      title: title ?? current.title,
      platform: platform ?? current.platform,
      status: status ?? current.status,
    );
    _games[index] = updated;
    return updated;
  }

  @override
  Future<void> deleteGame(String id) async {
    await Future.delayed(const Duration(milliseconds: 250));
    final index = _games.indexWhere((g) => g.id == id);
    if (index == -1) {
      throw const AppApiException('Jogo não encontrado.', statusCode: 404);
    }
    _games.removeAt(index);
  }

  // Helper method for catalog import to add to mock backlog
  void addImportedGame(BacklogGame game) {
    _games.insert(0, game);
  }

  bool containsImport(int rawgId, int platformId) {
    return _games.any((g) => g.rawgId == rawgId && g.platformId == platformId);
  }
}
