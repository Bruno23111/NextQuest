import 'package:games_backlog/core/models/paginated_result.dart';
import 'package:games_backlog/features/backlog/data/models/backlog_models.dart';
import 'models/catalog_models.dart';

abstract class CatalogRepository {
  Future<PaginatedResult<CatalogGame>> popularGames({int page = 1});
  Future<PaginatedResult<CatalogGame>> searchGames(String query, {int page = 1});
  Future<BacklogGame> importGame(int rawgId, int platformId);
}
