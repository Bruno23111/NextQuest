import 'models/steam_models.dart';

abstract class SteamRepository {
  Future<SteamLibrary> getLibrary();
  Future<SteamGameAchievements> getAchievements(int appId);
}
