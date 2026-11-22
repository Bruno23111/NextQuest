import 'profile_repository.dart';
import 'models/user_profile.dart';

class ProfileRepositoryMock implements ProfileRepository {
  static UserProfile _profile = const UserProfile(
    displayName: 'Jogador NextQuest',
    bio: 'Colecionando histórias, um jogo por vez.',
  );

  @override
  Future<UserProfile> getProfile() async => _profile;

  @override
  Future<UserProfile> updateProfile(UpdateUserProfile request) async {
    _profile = UserProfile(
      displayName: request.displayName.trim(),
      bio: _emptyToNull(request.bio),
      avatarUrl: _emptyToNull(request.avatarUrl),
      headerUrl: _emptyToNull(request.headerUrl),
    );
    return _profile;
  }

  static String? _emptyToNull(String? value) => value == null || value.trim().isEmpty ? null : value.trim();
}
