import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:games_backlog/core/constants/app_colors.dart';
import 'package:games_backlog/features/catalog/presentation/controllers/catalog_controller.dart';
import 'package:games_backlog/features/catalog/data/models/catalog_models.dart';
import 'package:games_backlog/features/catalog/presentation/widgets/catalog_game_card.dart';
import 'package:games_backlog/features/catalog/presentation/widgets/rawg_attribution.dart';
import 'package:games_backlog/features/catalog/presentation/widgets/select_platform_dialog.dart';

class CatalogSearchScreen extends ConsumerStatefulWidget {
  const CatalogSearchScreen({super.key});

  @override
  ConsumerState<CatalogSearchScreen> createState() => _CatalogSearchScreenState();
}

class _CatalogSearchScreenState extends ConsumerState<CatalogSearchScreen> {
  final _searchController = TextEditingController();
  final _scrollController = ScrollController();

  @override
  void initState() {
    super.initState();
    _scrollController.addListener(_onScroll);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      ref.read(catalogControllerProvider.notifier).loadPopular();
    });
  }

  @override
  void dispose() {
    _searchController.dispose();
    _scrollController.dispose();
    super.dispose();
  }

  void _onScroll() {
    if (_scrollController.position.pixels >= _scrollController.position.maxScrollExtent - 200) {
      ref.read(catalogControllerProvider.notifier).loadNextPage();
    }
  }

  void _triggerSearch() {
    ref.read(catalogControllerProvider.notifier).search(_searchController.text);
  }

  void _openPlatformDialog(CatalogGame game) {
    if (game.platforms.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Nenhuma plataforma disponível para este jogo.')),
      );
      return;
    }

    showDialog<bool>(
      context: context,
      builder: (ctx) => SelectPlatformDialog(
        game: game,
        onImport: (platformId) async {
          final success = await ref.read(catalogControllerProvider.notifier).importGame(
                rawgId: game.rawgId,
                platformId: platformId,
              );

          if (success && mounted) {
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(
                content: Text('"${game.title}" importado para sua biblioteca!'),
                backgroundColor: AppColors.success,
                action: SnackBarAction(
                  label: 'Ver na Biblioteca',
                  textColor: Colors.white,
                  onPressed: () => context.go('/library'),
                ),
              ),
            );
          }
          return success;
        },
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(catalogControllerProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Buscar jogos'),
      ),
      body: LayoutBuilder(
        builder: (context, constraints) {
          final isWide = constraints.maxWidth >= 720;
          final crossAxisCount = isWide
              ? (constraints.maxWidth ~/ 200).clamp(3, 6)
              : 2;

          return CustomScrollView(
            controller: _scrollController,
            slivers: [
              // Top Search and RAWG Attribution Header
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      // Search Bar
                      TextField(
                        controller: _searchController,
                        textInputAction: TextInputAction.search,
                        onSubmitted: (_) => _triggerSearch(),
                        decoration: InputDecoration(
                          hintText: 'Pesquisar jogos no catálogo...',
                          prefixIcon: const Icon(Icons.search_rounded),
                          suffixIcon: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              if (_searchController.text.isNotEmpty)
                                IconButton(
                                  icon: const Icon(Icons.clear_rounded, size: 18),
                                  onPressed: () {
                                    _searchController.clear();
                                    ref.read(catalogControllerProvider.notifier).loadPopular();
                                  },
                                ),
                              IconButton(
                                icon: const Icon(Icons.arrow_forward_rounded, color: AppColors.cyanAccent),
                                onPressed: _triggerSearch,
                              ),
                            ],
                          ),
                        ),
                      ),
                      const SizedBox(height: 12),

                      // RAWG Attribution Credit (Required on screens showing RAWG data)
                      const Align(
                        alignment: Alignment.centerLeft,
                        child: RawgAttribution(compact: true),
                      ),
                      const SizedBox(height: 12),
                      Text(
                        state.isPopular ? 'Jogos populares' : 'Resultados da busca',
                        style: const TextStyle(
                          color: AppColors.textPrimary,
                          fontSize: 15,
                          fontWeight: FontWeight.w700,
                        ),
                      ),

                      // Duplicate Error Banner (409)
                      if (state.errorMessage != null && state.isConflictError) ...[
                        const SizedBox(height: 14),
                        Container(
                          padding: const EdgeInsets.all(12),
                          decoration: BoxDecoration(
                            color: AppColors.warning.withValues(alpha: 0.15),
                            borderRadius: BorderRadius.circular(10),
                            border: Border.all(color: AppColors.warning.withValues(alpha: 0.5)),
                          ),
                          child: Row(
                            children: [
                              const Icon(Icons.info_outline_rounded, color: AppColors.warning, size: 20),
                              const SizedBox(width: 10),
                              Expanded(
                                child: Text(
                                  state.errorMessage!,
                                  style: const TextStyle(color: AppColors.warning, fontSize: 13),
                                ),
                              ),
                              IconButton(
                                icon: const Icon(Icons.close, size: 16, color: AppColors.warning),
                                onPressed: () => ref.read(catalogControllerProvider.notifier).clearError(),
                                padding: EdgeInsets.zero,
                                constraints: const BoxConstraints(),
                              ),
                            ],
                          ),
                        ),
                      ],

                      // Unavailable Service Error Banner (503)
                      if (state.errorMessage != null && state.isUnavailableError) ...[
                        const SizedBox(height: 14),
                        Container(
                          padding: const EdgeInsets.all(12),
                          decoration: BoxDecoration(
                            color: AppColors.error.withValues(alpha: 0.15),
                            borderRadius: BorderRadius.circular(10),
                            border: Border.all(color: AppColors.error.withValues(alpha: 0.5)),
                          ),
                          child: Row(
                            children: [
                              const Icon(Icons.cloud_off_rounded, color: AppColors.error, size: 20),
                              const SizedBox(width: 10),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      state.errorMessage!,
                                      style: const TextStyle(
                                        color: AppColors.error,
                                        fontWeight: FontWeight.bold,
                                        fontSize: 13,
                                      ),
                                    ),
                                    const SizedBox(height: 2),
                                    const Text(
                                      'A biblioteca e a adição manual continuam disponíveis.',
                                      style: TextStyle(color: AppColors.textSecondary, fontSize: 12),
                                    ),
                                  ],
                                ),
                              ),
                              TextButton(
                                onPressed: _triggerSearch,
                                child: const Text('Tentar novamente', style: TextStyle(color: AppColors.cyanAccent)),
                              ),
                            ],
                          ),
                        ),
                      ],

                      // Other Generic Error
                      if (state.errorMessage != null &&
                          !state.isConflictError &&
                          !state.isUnavailableError &&
                          state.games.isNotEmpty) ...[
                        const SizedBox(height: 14),
                        Container(
                          padding: const EdgeInsets.all(12),
                          decoration: BoxDecoration(
                            color: AppColors.error.withValues(alpha: 0.15),
                            borderRadius: BorderRadius.circular(10),
                            border: Border.all(color: AppColors.error.withValues(alpha: 0.5)),
                          ),
                          child: Text(
                            state.errorMessage!,
                            style: const TextStyle(color: AppColors.error, fontSize: 13),
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
              ),

              // Full Screen Error State when no games
              if (state.errorMessage != null && state.games.isEmpty)
                SliverFillRemaining(
                  hasScrollBody: false,
                  child: Center(
                    child: Padding(
                      padding: const EdgeInsets.all(24),
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(
                            state.isUnavailableError ? Icons.cloud_off_rounded : Icons.error_outline_rounded,
                            size: 54,
                            color: AppColors.error,
                          ),
                          const SizedBox(height: 16),
                          Text(
                            state.errorMessage!,
                            textAlign: TextAlign.center,
                            style: const TextStyle(
                              color: AppColors.textPrimary,
                              fontSize: 16,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                          const SizedBox(height: 8),
                          if (state.isUnavailableError)
                            const Text(
                              'O serviço externo RAWG está temporariamente indisponível. '
                              'Você ainda pode gerenciar sua biblioteca e adicionar jogos manualmente.',
                              textAlign: TextAlign.center,
                              style: TextStyle(color: AppColors.textSecondary, fontSize: 13),
                            ),
                          const SizedBox(height: 20),
                          ElevatedButton.icon(
                            onPressed: _triggerSearch,
                            icon: const Icon(Icons.refresh_rounded, size: 18),
                            label: const Text('Tentar novamente'),
                          ),
                        ],
                      ),
                    ),
                  ),
                )

              // Loading State
              else if (state.isLoading && state.games.isEmpty)
                const SliverFillRemaining(
                  hasScrollBody: false,
                  child: Center(
                    child: CircularProgressIndicator(color: AppColors.cyanAccent),
                  ),
                )

              // Empty results state
              else if (state.games.isEmpty && state.searchQuery.isNotEmpty)
                SliverFillRemaining(
                  hasScrollBody: false,
                  child: Center(
                    child: Padding(
                      padding: const EdgeInsets.all(32),
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          const Icon(Icons.search_off_rounded, size: 54, color: AppColors.textMuted),
                          const SizedBox(height: 16),
                          Text(
                            'Nenhum jogo encontrado para "${state.searchQuery}".',
                            textAlign: TextAlign.center,
                            style: const TextStyle(
                              fontSize: 16,
                              fontWeight: FontWeight.bold,
                              color: AppColors.textPrimary,
                            ),
                          ),
                          const SizedBox(height: 8),
                          const Text(
                            'Tente buscar por outro termo ou cadastre o jogo manualmente na biblioteca.',
                            textAlign: TextAlign.center,
                            style: TextStyle(fontSize: 13, color: AppColors.textSecondary),
                          ),
                        ],
                      ),
                    ),
                  ),
                )

              // Initial instructions
              else if (state.games.isEmpty)
                SliverFillRemaining(
                  hasScrollBody: false,
                  child: Center(
                    child: Padding(
                      padding: const EdgeInsets.all(32),
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Container(
                            padding: const EdgeInsets.all(20),
                            decoration: BoxDecoration(
                              color: AppColors.surfaceElevated,
                              shape: BoxShape.circle,
                            ),
                            child: const Icon(
                              Icons.travel_explore_rounded,
                              size: 56,
                              color: AppColors.cyanAccent,
                            ),
                          ),
                          const SizedBox(height: 20),
                          const Text(
                            'Catálogo Global RAWG',
                            style: TextStyle(
                              fontSize: 18,
                              fontWeight: FontWeight.bold,
                              color: AppColors.textPrimary,
                            ),
                          ),
                          const SizedBox(height: 8),
                          const Text(
                            'Digite o nome de qualquer jogo acima para buscar capas, plataformas e importar para a sua biblioteca.',
                            textAlign: TextAlign.center,
                            style: TextStyle(fontSize: 13, color: AppColors.textSecondary),
                          ),
                        ],
                      ),
                    ),
                  ),
                )

              // Results Grid
              else ...[
                SliverPadding(
                  padding: const EdgeInsets.all(16),
                  sliver: SliverGrid(
                    gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
                      crossAxisCount: crossAxisCount,
                      childAspectRatio: 0.68,
                      crossAxisSpacing: 14,
                      mainAxisSpacing: 14,
                    ),
                    delegate: SliverChildBuilderDelegate(
                      (context, index) {
                        final game = state.games[index];
                        return CatalogGameCard(
                          game: game,
                          onImportTap: () => _openPlatformDialog(game),
                        );
                      },
                      childCount: state.games.length,
                    ),
                  ),
                ),

                if (state.isLoadingMore)
                  const SliverToBoxAdapter(
                    child: Padding(
                      padding: EdgeInsets.symmetric(vertical: 24),
                      child: Center(
                        child: CircularProgressIndicator(color: AppColors.cyanAccent),
                      ),
                    ),
                  ),
              ],
            ],
          );
        },
      ),
    );
  }
}
