import 'models/user_profile.dart';

abstract class ProfileRepository {
  Future<UserProfile> getProfile();
  Future<UserProfile> updateProfile(UpdateUserProfile request);
}
