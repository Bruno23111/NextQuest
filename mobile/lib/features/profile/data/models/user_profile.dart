class UserProfile {
  final String displayName;
  final String? bio;
  final String? avatarUrl;
  final String? headerUrl;

  const UserProfile({
    required this.displayName,
    this.bio,
    this.avatarUrl,
    this.headerUrl,
  });

  factory UserProfile.fromJson(Map<String, dynamic> json) => UserProfile(
        displayName: json['displayName'] as String? ?? 'Jogador',
        bio: json['bio'] as String?,
        avatarUrl: json['avatarUrl'] as String?,
        headerUrl: json['headerUrl'] as String?,
      );
}

class UpdateUserProfile {
  final String displayName;
  final String? bio;
  final String? avatarUrl;
  final String? headerUrl;

  const UpdateUserProfile({
    required this.displayName,
    this.bio,
    this.avatarUrl,
    this.headerUrl,
  });

  Map<String, dynamic> toJson() => {
        'displayName': displayName,
        'bio': bio,
        'avatarUrl': avatarUrl,
        'headerUrl': headerUrl,
      };
}
