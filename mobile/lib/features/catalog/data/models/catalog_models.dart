class CatalogPlatform {
  final int id;
  final String name;

  const CatalogPlatform({required this.id, required this.name});

  factory CatalogPlatform.fromJson(Map<String, dynamic> json) {
    return CatalogPlatform(
      id: json['id'] as int,
      name: json['name'] as String,
    );
  }

  Map<String, dynamic> toJson() => {
    'id': id,
    'name': name,
  };
}

class CatalogGame {
  final int rawgId;
  final String title;
  final String? coverUrl;
  final List<CatalogPlatform> platforms;

  const CatalogGame({
    required this.rawgId,
    required this.title,
    this.coverUrl,
    required this.platforms,
  });

  factory CatalogGame.fromJson(Map<String, dynamic> json) {
    final rawPlatforms = json['platforms'] as List<dynamic>? ?? [];
    final platforms = rawPlatforms
        .whereType<Map<String, dynamic>>()
        .map(CatalogPlatform.fromJson)
        .toList();

    return CatalogGame(
      rawgId: json['rawgId'] as int,
      title: json['title'] as String,
      coverUrl: json['coverUrl'] as String?,
      platforms: platforms,
    );
  }

  Map<String, dynamic> toJson() => {
    'rawgId': rawgId,
    'title': title,
    'coverUrl': coverUrl,
    'platforms': platforms.map((p) => p.toJson()).toList(),
  };
}

class ImportGameRequest {
  final int rawgId;
  final int platformId;

  const ImportGameRequest({required this.rawgId, required this.platformId});

  Map<String, dynamic> toJson() => {
    'rawgId': rawgId,
    'platformId': platformId,
  };
}
