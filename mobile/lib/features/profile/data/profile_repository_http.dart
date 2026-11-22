import 'package:games_backlog/core/network/api_client.dart';
import 'profile_repository.dart';
import 'models/user_profile.dart';

class ProfileRepositoryHttp implements ProfileRepository {
  final ApiClient apiClient;

  ProfileRepositoryHttp({required this.apiClient});

  @override
  Future<UserProfile> getProfile() async {
    try {
      final response = await apiClient.dio.get('/api/v1/profile');
      return UserProfile.fromJson(response.data as Map<String, dynamic>);
    } catch (error) {
      throw ApiClient.handleException(error);
    }
  }

  @override
  Future<UserProfile> updateProfile(UpdateUserProfile request) async {
    try {
      final response = await apiClient.dio.put('/api/v1/profile', data: request.toJson());
      return UserProfile.fromJson(response.data as Map<String, dynamic>);
    } catch (error) {
      throw ApiClient.handleException(error);
    }
  }
}
