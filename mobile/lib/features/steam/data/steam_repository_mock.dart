import 'package:games_backlog/core/models/api_error.dart';
import 'steam_repository.dart';
import 'models/steam_models.dart';

class SteamRepositoryMock implements SteamRepository {
  static const _games = [
    SteamLibraryGame(appId: 1091500, name: 'Cyberpunk 2077', playtimeForeverMinutes: 4230),
    SteamLibraryGame(appId: 292030, name: 'The Witcher 3: Wild Hunt', playtimeForeverMinutes: 2880),
    SteamLibraryGame(appId: 367520, name: 'Hollow Knight', playtimeForeverMinutes: 1260),
  ];

  @override
  Future<SteamLibrary> getLibrary() async {
    await Future.delayed(const Duration(milliseconds: 250));
    return SteamLibrary(gameCount: _games.length, games: _games);
  }

  @override
  Future<SteamGameAchievements> getAchievements(int appId) async {
    await Future.delayed(const Duration(milliseconds: 250));
    final game = _games.firstWhere((item) => item.appId == appId);
    if (appId == 367520) {
      throw const AppApiException('A Steam não disponibilizou as conquistas deste jogo.', statusCode: 403);
    }
    const achievements = [
      SteamAchievement(
        apiName: 'ACH_FIRST_STEPS',
        name: 'Primeiros passos',
        description: 'Comece sua jornada.',
        achieved: true,
      ),
      SteamAchievement(
        apiName: 'ACH_COLLECTOR',
        name: 'Colecionador',
        description: 'Encontre todos os itens especiais.',
        achieved: false,
      ),
    ];
    return SteamGameAchievements(
      appId: appId,
      gameName: game.name,
      unlockedCount: 1,
      totalCount: achievements.length,
      achievements: achievements,
    );
  }
}
