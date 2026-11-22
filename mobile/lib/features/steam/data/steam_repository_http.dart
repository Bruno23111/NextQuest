import 'package:games_backlog/core/network/api_client.dart';
import 'steam_repository.dart';
import 'models/steam_models.dart';

class SteamRepositoryHttp implements SteamRepository {
  final ApiClient apiClient;

  SteamRepositoryHttp({required this.apiClient});

  @override
  Future<SteamLibrary> getLibrary() async {
    try {
      final response = await apiClient.dio.get('/api/v1/steam/library');
      return SteamLibrary.fromJson(response.data as Map<String, dynamic>);
    } catch (error) {
      throw ApiClient.handleException(error);
    }
  }

  @override
  Future<SteamGameAchievements> getAchievements(int appId) async {
    try {
      final response = await apiClient.dio.get('/api/v1/steam/games/$appId/achievements');
      return SteamGameAchievements.fromJson(response.data as Map<String, dynamic>);
    } catch (error) {
      throw ApiClient.handleException(error);
    }
  }
}
