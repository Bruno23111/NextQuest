import 'package:games_backlog/core/models/paginated_result.dart';
import 'package:games_backlog/core/network/api_client.dart';
import 'package:games_backlog/features/backlog/data/models/backlog_models.dart';
import 'catalog_repository.dart';
import 'models/catalog_models.dart';

class CatalogRepositoryHttp implements CatalogRepository {
  final ApiClient apiClient;

  CatalogRepositoryHttp({required this.apiClient});

  @override
  Future<PaginatedResult<CatalogGame>> popularGames({int page = 1}) async {
    try {
      final response = await apiClient.dio.get(
        '/api/v1/catalog/popular',
        queryParameters: {'page': page},
      );

      final data = response.data as Map<String, dynamic>;
      return PaginatedResult.fromJson(
        data,
        (itemJson) => CatalogGame.fromJson(itemJson),
      );
    } catch (e) {
      throw ApiClient.handleException(e);
    }
  }

  @override
  Future<PaginatedResult<CatalogGame>> searchGames(String query, {int page = 1}) async {
    try {
      final response = await apiClient.dio.get(
        '/api/v1/catalog/games',
        queryParameters: {
          'q': query,
          'page': page,
        },
      );

      final data = response.data as Map<String, dynamic>;
      return PaginatedResult.fromJson(
        data,
        (itemJson) => CatalogGame.fromJson(itemJson),
      );
    } catch (e) {
      throw ApiClient.handleException(e);
    }
  }

  @override
  Future<BacklogGame> importGame(int rawgId, int platformId) async {
    try {
      final response = await apiClient.dio.post(
        '/api/v1/backlog/import',
        data: ImportGameRequest(rawgId: rawgId, platformId: platformId).toJson(),
      );

      return BacklogGame.fromJson(response.data as Map<String, dynamic>);
    } catch (e) {
      throw ApiClient.handleException(e);
    }
  }
}
