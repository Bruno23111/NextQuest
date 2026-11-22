import 'package:games_backlog/core/models/game_status.dart';

class BacklogGame {
  final String id;
  final String title;
  final String platform;
  final GameStatus status;
  final int? rawgId;
  final int? platformId;
  final String? coverUrl;
  final DateTime createdAt;

  const BacklogGame({
    required this.id,
    required this.title,
    required this.platform,
    required this.status,
    this.rawgId,
    this.platformId,
    this.coverUrl,
    required this.createdAt,
  });

  bool get isImportedFromRawg => rawgId != null;

  factory BacklogGame.fromJson(Map<String, dynamic> json) {
    return BacklogGame(
      id: json['id'] as String,
      title: json['title'] as String,
      platform: json['platform'] as String,
      status: GameStatus.fromApiValue(json['status'] as String?),
      rawgId: json['rawgId'] as int?,
      platformId: json['platformId'] as int?,
      coverUrl: json['coverUrl'] as String?,
      createdAt: json['createdAt'] != null
          ? DateTime.tryParse(json['createdAt'] as String) ?? DateTime.now()
          : DateTime.now(),
    );
  }

  Map<String, dynamic> toJson() => {
    'id': id,
    'title': title,
    'platform': platform,
    'status': status.toApiValue(),
    'rawgId': rawgId,
    'platformId': platformId,
    'coverUrl': coverUrl,
    'createdAt': createdAt.toIso8601String(),
  };

  BacklogGame copyWith({
    String? id,
    String? title,
    String? platform,
    GameStatus? status,
    int? rawgId,
    int? platformId,
    String? coverUrl,
    DateTime? createdAt,
  }) {
    return BacklogGame(
      id: id ?? this.id,
      title: title ?? this.title,
      platform: platform ?? this.platform,
      status: status ?? this.status,
      rawgId: rawgId ?? this.rawgId,
      platformId: platformId ?? this.platformId,
      coverUrl: coverUrl ?? this.coverUrl,
      createdAt: createdAt ?? this.createdAt,
    );
  }
}

class CreateGameRequest {
  final String title;
  final String platform;

  const CreateGameRequest({required this.title, required this.platform});

  Map<String, dynamic> toJson() => {
    'title': title,
    'platform': platform,
  };
}

class UpdateGameRequest {
  final String? title;
  final String? platform;
  final GameStatus? status;

  const UpdateGameRequest({this.title, this.platform, this.status});

  Map<String, dynamic> toJson() => {
    'title': title,
    'platform': platform,
    'status': status?.toApiValue(),
  };
}
