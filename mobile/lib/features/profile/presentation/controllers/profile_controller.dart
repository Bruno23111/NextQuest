import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:games_backlog/core/config/env_config.dart';
import 'package:games_backlog/features/auth/presentation/controllers/auth_controller.dart';
import 'package:games_backlog/features/profile/data/profile_repository.dart';
import 'package:games_backlog/features/profile/data/profile_repository_http.dart';
import 'package:games_backlog/features/profile/data/profile_repository_mock.dart';
import 'package:games_backlog/features/profile/data/models/user_profile.dart';

final profileRepositoryProvider = Provider<ProfileRepository>((ref) {
  if (EnvConfig.useMockApi) return ProfileRepositoryMock();
  return ProfileRepositoryHttp(apiClient: ref.watch(apiClientProvider));
});

final userProfileProvider = FutureProvider.autoDispose<UserProfile>(
  (ref) => ref.watch(profileRepositoryProvider).getProfile(),
);
