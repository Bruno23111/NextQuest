class SteamLibrary {
  final int gameCount;
  final List<SteamLibraryGame> games;

  const SteamLibrary({required this.gameCount, required this.games});

  factory SteamLibrary.fromJson(Map<String, dynamic> json) => SteamLibrary(
        gameCount: (json['gameCount'] as num?)?.toInt() ?? 0,
        games: (json['games'] as List<dynamic>? ?? const [])
            .whereType<Map<String, dynamic>>()
            .map(SteamLibraryGame.fromJson)
            .toList(),
      );
}

class SteamLibraryGame {
  final int appId;
  final String name;
  final int playtimeForeverMinutes;
  final int? playtimeTwoWeeksMinutes;
  final String? iconUrl;

  const SteamLibraryGame({
    required this.appId,
    required this.name,
    required this.playtimeForeverMinutes,
    this.playtimeTwoWeeksMinutes,
    this.iconUrl,
  });

  factory SteamLibraryGame.fromJson(Map<String, dynamic> json) => SteamLibraryGame(
        appId: json['appId'] as int,
        name: json['name'] as String? ?? 'Jogo Steam',
        playtimeForeverMinutes: (json['playtimeForeverMinutes'] as num?)?.toInt() ?? 0,
        playtimeTwoWeeksMinutes: (json['playtimeTwoWeeksMinutes'] as num?)?.toInt(),
        iconUrl: json['iconUrl'] as String?,
      );

  String get playtimeLabel {
    final hours = playtimeForeverMinutes ~/ 60;
    final minutes = playtimeForeverMinutes % 60;
    if (hours == 0) return '$minutes min';
    return '${hours}h ${minutes.toString().padLeft(2, '0')}m';
  }
}

class SteamGameAchievements {
  final int appId;
  final String gameName;
  final int unlockedCount;
  final int totalCount;
  final List<SteamAchievement> achievements;

  const SteamGameAchievements({
    required this.appId,
    required this.gameName,
    required this.unlockedCount,
    required this.totalCount,
    required this.achievements,
  });

  factory SteamGameAchievements.fromJson(Map<String, dynamic> json) => SteamGameAchievements(
        appId: json['appId'] as int,
        gameName: json['gameName'] as String? ?? 'Conquistas',
        unlockedCount: (json['unlockedCount'] as num?)?.toInt() ?? 0,
        totalCount: (json['totalCount'] as num?)?.toInt() ?? 0,
        achievements: (json['achievements'] as List<dynamic>? ?? const [])
            .whereType<Map<String, dynamic>>()
            .map(SteamAchievement.fromJson)
            .toList(),
      );
}

class SteamAchievement {
  final String apiName;
  final String name;
  final String? description;
  final bool achieved;
  final DateTime? unlockedAt;
  final String? iconUrl;
  final String? grayIconUrl;

  const SteamAchievement({
    required this.apiName,
    required this.name,
    this.description,
    required this.achieved,
    this.unlockedAt,
    this.iconUrl,
    this.grayIconUrl,
  });

  factory SteamAchievement.fromJson(Map<String, dynamic> json) => SteamAchievement(
        apiName: json['apiName'] as String? ?? '',
        name: json['name'] as String? ?? 'Conquista',
        description: json['description'] as String?,
        achieved: json['achieved'] as bool? ?? false,
        unlockedAt: DateTime.tryParse(json['unlockedAt'] as String? ?? ''),
        iconUrl: json['iconUrl'] as String?,
        grayIconUrl: json['grayIconUrl'] as String?,
      );
}
