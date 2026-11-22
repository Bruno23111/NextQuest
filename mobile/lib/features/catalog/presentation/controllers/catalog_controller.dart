import 'package:flutter_riverpod/legacy.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:games_backlog/core/config/env_config.dart';
import 'package:games_backlog/core/models/api_error.dart';
import 'package:games_backlog/features/auth/presentation/controllers/auth_controller.dart';
import 'package:games_backlog/features/backlog/presentation/controllers/backlog_controller.dart';
import 'package:games_backlog/features/catalog/data/catalog_repository.dart';
import 'package:games_backlog/features/catalog/data/catalog_repository_http.dart';
import 'package:games_backlog/features/catalog/data/catalog_repository_mock.dart';
import 'package:games_backlog/features/catalog/data/models/catalog_models.dart';

final catalogRepositoryProvider = Provider<CatalogRepository>((ref) {
  if (EnvConfig.useMockApi) {
    final mockBacklog = ref.watch(mockBacklogRepoSingletonProvider);
    return CatalogRepositoryMock(backlogRepository: mockBacklog);
  }
  final client = ref.watch(apiClientProvider);
  return CatalogRepositoryHttp(apiClient: client);
});

class CatalogState {
  final List<CatalogGame> games;
  final String searchQuery;
  final bool isPopular;
  final int currentPage;
  final bool hasMore;
  final bool isLoading;
  final bool isLoadingMore;
  final bool isImporting;
  final String? errorMessage;
  final int? errorStatusCode;

  const CatalogState({
    this.games = const [],
    this.searchQuery = '',
    this.isPopular = false,
    this.currentPage = 1,
    this.hasMore = false,
    this.isLoading = false,
    this.isLoadingMore = false,
    this.isImporting = false,
    this.errorMessage,
    this.errorStatusCode,
  });

  bool get isConflictError => errorStatusCode == 409;
  bool get isUnavailableError => errorStatusCode == 503;

  CatalogState copyWith({
    List<CatalogGame>? games,
    String? searchQuery,
    bool? isPopular,
    int? currentPage,
    bool? hasMore,
    bool? isLoading,
    bool? isLoadingMore,
    bool? isImporting,
    String? errorMessage,
    int? errorStatusCode,
    bool clearError = false,
  }) {
    return CatalogState(
      games: games ?? this.games,
      searchQuery: searchQuery ?? this.searchQuery,
      isPopular: isPopular ?? this.isPopular,
      currentPage: currentPage ?? this.currentPage,
      hasMore: hasMore ?? this.hasMore,
      isLoading: isLoading ?? this.isLoading,
      isLoadingMore: isLoadingMore ?? this.isLoadingMore,
      isImporting: isImporting ?? this.isImporting,
      errorMessage: clearError ? null : (errorMessage ?? this.errorMessage),
      errorStatusCode: clearError ? null : (errorStatusCode ?? this.errorStatusCode),
    );
  }
}

class CatalogController extends StateNotifier<CatalogState> {
  final CatalogRepository _repository;
  final Ref _ref;

  CatalogController({required CatalogRepository repository, required Ref ref})
      : _repository = repository,
        _ref = ref,
        super(const CatalogState());

  Future<void> search(String query, {bool refresh = true}) async {
    final trimmed = query.trim();
    if (trimmed.isEmpty) {
      await loadPopular();
      return;
    }

    state = state.copyWith(
      isLoading: true,
      searchQuery: trimmed,
      isPopular: false,
      currentPage: 1,
      clearError: true,
    );

    try {
      final result = await _repository.searchGames(trimmed, page: 1);
      state = state.copyWith(
        games: result.items,
        currentPage: result.page,
        hasMore: result.hasMore,
        isLoading: false,
        clearError: true,
      );
    } catch (e) {
      int? statusCode;
      String message = e.toString();
      if (e is AppApiException) {
        statusCode = e.statusCode;
        message = e.message;
      }
      state = state.copyWith(
        isLoading: false,
        errorMessage: message,
        errorStatusCode: statusCode,
      );
    }
  }

  Future<void> loadPopular({bool refresh = true}) async {
    if (!refresh && state.isLoading) return;
    state = state.copyWith(
      isLoading: true,
      isPopular: true,
      searchQuery: '',
      currentPage: 1,
      clearError: true,
    );
    try {
      final result = await _repository.popularGames(page: 1);
      state = state.copyWith(
        games: result.items,
        currentPage: result.page,
        hasMore: result.hasMore,
        isLoading: false,
        clearError: true,
      );
    } catch (e) {
      int? statusCode;
      String message = e.toString();
      if (e is AppApiException) {
        statusCode = e.statusCode;
        message = e.message;
      }
      state = state.copyWith(isLoading: false, errorMessage: message, errorStatusCode: statusCode);
    }
  }

  Future<void> loadNextPage() async {
    if (state.isLoadingMore || !state.hasMore || (!state.isPopular && state.searchQuery.isEmpty)) return;

    state = state.copyWith(isLoadingMore: true);
    try {
      final nextPage = state.currentPage + 1;
      final result = state.isPopular
          ? await _repository.popularGames(page: nextPage)
          : await _repository.searchGames(state.searchQuery, page: nextPage);
      state = state.copyWith(
        games: [...state.games, ...result.items],
        currentPage: result.page,
        hasMore: result.hasMore,
        isLoadingMore: false,
      );
    } catch (_) {
      state = state.copyWith(isLoadingMore: false);
    }
  }

  Future<bool> importGame({
    required int rawgId,
    required int platformId,
  }) async {
    state = state.copyWith(isImporting: true, clearError: true);
    try {
      await _repository.importGame(rawgId, platformId);
      state = state.copyWith(isImporting: false, clearError: true);
      // Refresh backlog so new game appears in library
      _ref.read(backlogControllerProvider.notifier).fetchBacklog(refresh: true);
      return true;
    } catch (e) {
      int? statusCode;
      String message = e.toString();
      if (e is AppApiException) {
        statusCode = e.statusCode;
        message = e.message;
      }
      state = state.copyWith(
        isImporting: false,
        errorMessage: message,
        errorStatusCode: statusCode,
      );
      return false;
    }
  }

  void clearError() {
    state = state.copyWith(clearError: true);
  }
}

final catalogControllerProvider =
    StateNotifierProvider<CatalogController, CatalogState>((ref) {
  final repository = ref.watch(catalogRepositoryProvider);
  return CatalogController(repository: repository, ref: ref);
});
