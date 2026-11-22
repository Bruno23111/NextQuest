import 'package:games_backlog/core/models/game_status.dart';
import 'package:games_backlog/core/models/paginated_result.dart';
import 'package:games_backlog/core/network/api_client.dart';
import 'backlog_repository.dart';
import 'models/backlog_models.dart';

class BacklogRepositoryHttp implements BacklogRepository {
  final ApiClient apiClient;

  BacklogRepositoryHttp({required this.apiClient});

  @override
  Future<PaginatedResult<BacklogGame>> getBacklog({
    String? query,
    GameStatus? status,
    int page = 1,
  }) async {
    try {
      final queryParams = <String, dynamic>{
        'page': page,
      };
      if (query != null && query.trim().isNotEmpty) {
        queryParams['q'] = query.trim();
      }
      if (status != null) {
        queryParams['status'] = status.toApiValue();
      }

      final response = await apiClient.dio.get(
        '/api/v1/backlog',
        queryParameters: queryParams,
      );

      final data = response.data as Map<String, dynamic>;
      return PaginatedResult.fromJson(
        data,
        (itemJson) => BacklogGame.fromJson(itemJson),
      );
    } catch (e) {
      throw ApiClient.handleException(e);
    }
  }

  @override
  Future<BacklogGame> getGameById(String id) async {
    try {
      final response = await apiClient.dio.get('/api/v1/backlog/$id');
      return BacklogGame.fromJson(response.data as Map<String, dynamic>);
    } catch (e) {
      throw ApiClient.handleException(e);
    }
  }

  @override
  Future<BacklogGame> createGame(String title, String platform) async {
    try {
      final response = await apiClient.dio.post(
        '/api/v1/backlog',
        data: CreateGameRequest(title: title, platform: platform).toJson(),
      );
      return BacklogGame.fromJson(response.data as Map<String, dynamic>);
    } catch (e) {
      throw ApiClient.handleException(e);
    }
  }

  @override
  Future<BacklogGame> updateGame(
    String id, {
    String? title,
    String? platform,
    GameStatus? status,
  }) async {
    try {
      // Fetch current game if title or platform are omitted to satisfy API requirements
      String? currentTitle = title;
      String? currentPlatform = platform;
      if (currentTitle == null || currentPlatform == null) {
        try {
          final existing = await getGameById(id);
          currentTitle ??= existing.title;
          currentPlatform ??= existing.platform;
        } catch (_) {
          // ignore
        }
      }

      final response = await apiClient.dio.patch(
        '/api/v1/backlog/$id',
        data: {
          'title': currentTitle,
          'platform': currentPlatform,
          'status': status?.toApiValue(),
        },
      );
      return BacklogGame.fromJson(response.data as Map<String, dynamic>);
    } catch (e) {
      throw ApiClient.handleException(e);
    }
  }

  @override
  Future<void> deleteGame(String id) async {
    try {
      await apiClient.dio.delete('/api/v1/backlog/$id');
    } catch (e) {
      throw ApiClient.handleException(e);
    }
  }
}
