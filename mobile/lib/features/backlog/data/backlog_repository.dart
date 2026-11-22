import 'package:games_backlog/core/models/game_status.dart';
import 'package:games_backlog/core/models/paginated_result.dart';
import 'models/backlog_models.dart';

abstract class BacklogRepository {
  Future<PaginatedResult<BacklogGame>> getBacklog({
    String? query,
    GameStatus? status,
    int page = 1,
  });

  Future<BacklogGame> getGameById(String id);
  Future<BacklogGame> createGame(String title, String platform);
  Future<BacklogGame> updateGame(
    String id, {
    String? title,
    String? platform,
    GameStatus? status,
  });
  Future<void> deleteGame(String id);
}
