import 'package:flutter_riverpod/legacy.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:games_backlog/core/config/env_config.dart';
import 'package:games_backlog/core/models/game_status.dart';
import 'package:games_backlog/features/auth/presentation/controllers/auth_controller.dart';
import 'package:games_backlog/features/backlog/data/backlog_repository.dart';
import 'package:games_backlog/features/backlog/data/backlog_repository_http.dart';
import 'package:games_backlog/features/backlog/data/backlog_repository_mock.dart';
import 'package:games_backlog/features/backlog/data/models/backlog_models.dart';

final mockBacklogRepoSingletonProvider = Provider<BacklogRepositoryMock>((ref) {
  return BacklogRepositoryMock();
});

final backlogRepositoryProvider = Provider<BacklogRepository>((ref) {
  if (EnvConfig.useMockApi) {
    return ref.watch(mockBacklogRepoSingletonProvider);
  }
  final client = ref.watch(apiClientProvider);
  return BacklogRepositoryHttp(apiClient: client);
});

class BacklogState {
  final List<BacklogGame> games;
  final GameStatus? selectedStatus;
  final String searchQuery;
  final int currentPage;
  final bool hasMore;
  final bool isLoading;
  final bool isLoadingMore;
  final String? errorMessage;

  const BacklogState({
    this.games = const [],
    this.selectedStatus,
    this.searchQuery = '',
    this.currentPage = 1,
    this.hasMore = false,
    this.isLoading = false,
    this.isLoadingMore = false,
    this.errorMessage,
  });

  /// The game that is currently being played, if any.
  BacklogGame? get playingNowGame {
    try {
      return games.firstWhere((g) => g.status == GameStatus.playing);
    } catch (_) {
      return null;
    }
  }

  BacklogState copyWith({
    List<BacklogGame>? games,
    GameStatus? selectedStatus,
    bool clearStatus = false,
    String? searchQuery,
    int? currentPage,
    bool? hasMore,
    bool? isLoading,
    bool? isLoadingMore,
    String? errorMessage,
    bool clearError = false,
  }) {
    return BacklogState(
      games: games ?? this.games,
      selectedStatus: clearStatus ? null : (selectedStatus ?? this.selectedStatus),
      searchQuery: searchQuery ?? this.searchQuery,
      currentPage: currentPage ?? this.currentPage,
      hasMore: hasMore ?? this.hasMore,
      isLoading: isLoading ?? this.isLoading,
      isLoadingMore: isLoadingMore ?? this.isLoadingMore,
      errorMessage: clearError ? null : (errorMessage ?? this.errorMessage),
    );
  }
}

class BacklogController extends StateNotifier<BacklogState> {
  final BacklogRepository _repository;

  BacklogController({required BacklogRepository repository})
      : _repository = repository,
        super(const BacklogState()) {
    fetchBacklog(refresh: true);
  }

  Future<void> fetchBacklog({bool refresh = false}) async {
    if (refresh) {
      state = state.copyWith(isLoading: true, clearError: true, currentPage: 1);
    }

    try {
      final page = refresh ? 1 : state.currentPage;
      final result = await _repository.getBacklog(
        query: state.searchQuery,
        status: state.selectedStatus,
        page: page,
      );

      state = state.copyWith(
        games: result.items,
        currentPage: result.page,
        hasMore: result.hasMore,
        isLoading: false,
        clearError: true,
      );
    } catch (e) {
      state = state.copyWith(
        isLoading: false,
        errorMessage: e.toString(),
      );
    }
  }

  Future<void> loadNextPage() async {
    if (state.isLoadingMore || !state.hasMore) return;

    state = state.copyWith(isLoadingMore: true);
    try {
      final nextPage = state.currentPage + 1;
      final result = await _repository.getBacklog(
        query: state.searchQuery,
        status: state.selectedStatus,
        page: nextPage,
      );

      state = state.copyWith(
        games: [...state.games, ...result.items],
        currentPage: result.page,
        hasMore: result.hasMore,
        isLoadingMore: false,
      );
    } catch (e) {
      state = state.copyWith(isLoadingMore: false);
    }
  }

  void setStatusFilter(GameStatus? status) {
    if (state.selectedStatus == status) return;
    state = state.copyWith(
      selectedStatus: status,
      clearStatus: status == null,
    );
    fetchBacklog(refresh: true);
  }

  void setSearchQuery(String query) {
    if (state.searchQuery == query) return;
    state = state.copyWith(searchQuery: query);
    fetchBacklog(refresh: true);
  }

  Future<bool> addManualGame(String title, String platform) async {
    try {
      await _repository.createGame(title, platform);
      await fetchBacklog(refresh: true);
      return true;
    } catch (e) {
      state = state.copyWith(errorMessage: e.toString());
      return false;
    }
  }

  Future<bool> updateGameStatus(String id, GameStatus newStatus) async {
    try {
      final updated = await _repository.updateGame(id, status: newStatus);
      final updatedList = state.games.map((g) => g.id == id ? updated : g).toList();
      state = state.copyWith(games: updatedList);
      return true;
    } catch (e) {
      state = state.copyWith(errorMessage: e.toString());
      return false;
    }
  }

  Future<bool> deleteGame(String id) async {
    try {
      await _repository.deleteGame(id);
      final updatedList = state.games.where((g) => g.id != id).toList();
      state = state.copyWith(games: updatedList);
      return true;
    } catch (e) {
      state = state.copyWith(errorMessage: e.toString());
      return false;
    }
  }
}

final backlogControllerProvider =
    StateNotifierProvider<BacklogController, BacklogState>((ref) {
  final repository = ref.watch(backlogRepositoryProvider);
  return BacklogController(repository: repository);
});
