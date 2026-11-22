import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:games_backlog/core/constants/app_colors.dart';
import 'package:games_backlog/core/constants/app_strings.dart';
import 'package:games_backlog/core/models/game_status.dart';
import 'package:games_backlog/core/utils/platform_utils.dart';
import 'package:games_backlog/core/widgets/nextquest_logo.dart';
import 'package:games_backlog/features/backlog/data/models/backlog_models.dart';
import 'package:games_backlog/features/backlog/presentation/controllers/backlog_controller.dart';
import 'package:games_backlog/features/backlog/presentation/widgets/add_game_dialog.dart';
import 'package:games_backlog/features/backlog/presentation/widgets/game_card.dart';
import 'package:games_backlog/features/backlog/presentation/widgets/playing_now_card.dart';

class BacklogScreen extends ConsumerStatefulWidget {
  const BacklogScreen({super.key});

  @override
  ConsumerState<BacklogScreen> createState() => _BacklogScreenState();
}

class _BacklogScreenState extends ConsumerState<BacklogScreen> {
  final _search = TextEditingController();
  final _scroll = ScrollController();
  bool _showSearch = false;

  BacklogController get _controller =>
      ref.read(backlogControllerProvider.notifier);

  @override
  void initState() {
    super.initState();
    _scroll.addListener(_onScroll);
  }

  @override
  void dispose() {
    _search.dispose();
    _scroll.dispose();
    super.dispose();
  }

  void _onScroll() {
    if (_scroll.position.extentAfter < 200) {
      _controller.loadNextPage();
    }
  }

  void _openGame(BacklogGame game) {
    context.push('/library/${game.id}', extra: game);
  }

  void _openAddManualDialog() {
    showDialog<bool>(
      context: context,
      builder: (_) => AddGameDialog(
        onAdd: (title, platform) async {
          final success = await _controller.addManualGame(title, platform);
          if (success && mounted) {
            ScaffoldMessenger.of(context).showSnackBar(
              const SnackBar(content: Text('Jogo adicionado com sucesso!')),
            );
          }
          return success;
        },
      ),
    );
  }

  void _clearSearch() {
    _search.clear();
    _controller.setSearchQuery('');
  }

  void _toggleSearch() {
    if (_showSearch) _clearSearch();
    setState(() => _showSearch = !_showSearch);
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(backlogControllerProvider);
    final playingSection = state.selectedStatus == GameStatus.playing;
    final filtered =
        state.searchQuery.isNotEmpty || state.selectedStatus != null;
    final featuredGame =
        !state.isLoading &&
            state.searchQuery.isEmpty &&
            (state.selectedStatus == null || playingSection)
        ? state.playingNowGame
        : null;

    return Scaffold(
      body: SafeArea(
        bottom: false,
        child: LayoutBuilder(
          builder: (context, constraints) {
            final wide = constraints.maxWidth >= 720;
            final inset = math.max(
              wide ? 32.0 : 16.0,
              (constraints.maxWidth - 1200) / 2,
            );
            final contentWidth = constraints.maxWidth - 2 * inset;
            final columns = switch (contentWidth) {
              >= 970 => 4,
              >= 590 => 3,
              >= 270 => 2,
              _ => 1,
            };
            final gap = wide ? 16.0 : 10.0;
            final cardWidth = (contentWidth - (columns - 1) * gap) / columns;
            final textScale = MediaQuery.textScalerOf(context).scale(14) / 14;

            return RefreshIndicator(
              onRefresh: () => _controller.fetchBacklog(refresh: true),
              child: CustomScrollView(
                controller: _scroll,
                physics: const AlwaysScrollableScrollPhysics(),
                slivers: [
                  SliverPadding(
                    padding: EdgeInsets.fromLTRB(
                      inset,
                      wide ? 30 : 14,
                      inset,
                      0,
                    ),
                    sliver: SliverToBoxAdapter(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          _LibraryHeader(
                            wide: wide,
                            onAdd: _openAddManualDialog,
                            onSteamLibrary: () => context.go('/library'),
                            searchOpen: _showSearch,
                            onToggleSearch: _toggleSearch,
                          ),
                          const SizedBox(height: 15),
                          _CollectionToolbar(
                            wide: wide,
                            showSearch: wide || _showSearch,
                            search: _search,
                            onClearSearch: _clearSearch,
                            onSearch: _controller.setSearchQuery,
                            selectedStatus: state.selectedStatus,
                            onSelectStatus: _controller.setStatusFilter,
                          ),
                          if (featuredGame != null &&
                              (wide || playingSection)) ...[
                            const SizedBox(height: 12),
                            PlayingNowCard(
                              game: featuredGame,
                              onTap: () => _openGame(featuredGame),
                            ),
                          ],
                        ],
                      ),
                    ),
                  ),
                  if (state.isLoading || state.games.isEmpty)
                    SliverFillRemaining(
                      hasScrollBody: false,
                      child: Padding(
                        padding: EdgeInsets.fromLTRB(inset, 18, inset, 28),
                        child: _CollectionMessage(
                          state: state,
                          filtered: filtered,
                          onRetry: () =>
                              _controller.fetchBacklog(refresh: true),
                          onAdd: _openAddManualDialog,
                          onSearch: () => context.go('/search'),
                        ),
                      ),
                    )
                  else ...[
                    SliverPadding(
                      padding: EdgeInsets.fromLTRB(inset, 12, inset, 0),
                      sliver: SliverGrid.builder(
                        gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
                          crossAxisCount: columns,
                          crossAxisSpacing: gap,
                          mainAxisSpacing: gap,
                          mainAxisExtent:
                              cardWidth * 1.02 + 59 * math.max(1, textScale),
                        ),
                        itemCount: state.games.length,
                        itemBuilder: (context, index) {
                          final game = state.games[index];
                          return GameCard(
                            game: game,
                            onTap: () => _openGame(game),
                          );
                        },
                      ),
                    ),
                    SliverPadding(
                      padding: EdgeInsets.fromLTRB(inset, 12, inset, 18),
                      sliver: SliverToBoxAdapter(
                        child: state.isLoadingMore
                            ? const Padding(
                                padding: EdgeInsets.all(16),
                                child: Center(
                                  child: CircularProgressIndicator(),
                                ),
                              )
                            : state.games.any((game) => game.isImportedFromRawg)
                            ? Align(
                                alignment: Alignment.centerLeft,
                                child: TextButton.icon(
                                  onPressed: () =>
                                      PlatformUtils.openExternalUrl(
                                        AppStrings.rawgUrl,
                                      ),
                                  icon: const Icon(
                                    Icons.open_in_new_rounded,
                                    size: 14,
                                  ),
                                  label: const Text(AppStrings.rawgCredit),
                                ),
                              )
                            : const SizedBox.shrink(),
                      ),
                    ),
                  ],
                ],
              ),
            );
          },
        ),
      ),
    );
  }
}

class _LibraryHeader extends StatelessWidget {
  const _LibraryHeader({
    required this.wide,
    required this.onAdd,
    required this.onSteamLibrary,
    required this.searchOpen,
    required this.onToggleSearch,
  });

  final bool wide;
  final VoidCallback onAdd;
  final VoidCallback onSteamLibrary;
  final bool searchOpen;
  final VoidCallback onToggleSearch;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        if (!wide) ...[
          const NextQuestLogo(size: 36),
          const SizedBox(width: 10),
        ],
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              if (!wide)
                const Text(
                  AppStrings.appTitle,
                  style: TextStyle(
                    color: AppColors.textMuted,
                    fontSize: 12,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              Text(
                'Minha biblioteca',
                style: TextStyle(
                  color: AppColors.textPrimary,
                  fontWeight: FontWeight.w800,
                  fontSize: wide ? 34 : 21,
                  letterSpacing: wide ? -1.05 : -.45,
                ),
              ),
            ],
          ),
        ),
        if (wide)
          Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              OutlinedButton.icon(
                onPressed: onSteamLibrary,
                icon: const Icon(Icons.sports_esports_rounded, size: 18),
                label: const Text('Steam'),
              ),
              const SizedBox(width: 8),
              FilledButton.icon(
                onPressed: onAdd,
                icon: const Icon(Icons.add_rounded, size: 19),
                label: const Text('Adicionar jogo'),
              ),
            ],
          )
        else ...[
          IconButton(
            onPressed: onToggleSearch,
            tooltip: searchOpen ? 'Fechar busca' : 'Buscar na biblioteca',
            icon: Icon(searchOpen ? Icons.close_rounded : Icons.search_rounded),
          ),
          IconButton(
            onPressed: onSteamLibrary,
            tooltip: 'Voltar à biblioteca Steam',
            icon: const Icon(Icons.sports_esports_rounded),
          ),
          IconButton.filledTonal(
            onPressed: onAdd,
            tooltip: AppStrings.addManually,
            icon: const Icon(Icons.add_rounded),
          ),
        ],
      ],
    );
  }
}

class _CollectionToolbar extends StatelessWidget {
  const _CollectionToolbar({
    required this.wide,
    required this.showSearch,
    required this.search,
    required this.onClearSearch,
    required this.onSearch,
    required this.selectedStatus,
    required this.onSelectStatus,
  });

  final bool wide;
  final bool showSearch;
  final TextEditingController search;
  final VoidCallback onClearSearch;
  final ValueChanged<String> onSearch;
  final GameStatus? selectedStatus;
  final ValueChanged<GameStatus?> onSelectStatus;

  @override
  Widget build(BuildContext context) {
    final playing = selectedStatus == GameStatus.playing;
    final sections = SegmentedButton<bool>(
      showSelectedIcon: false,
      segments: const [
        ButtonSegment(value: false, label: Text('Jogos')),
        ButtonSegment(value: true, label: Text('Em andamento')),
      ],
      selected: {playing},
      onSelectionChanged: (value) =>
          onSelectStatus(value.single ? GameStatus.playing : null),
      style: ButtonStyle(
        visualDensity: VisualDensity.compact,
        backgroundColor: WidgetStateProperty.resolveWith(
          (states) => states.contains(WidgetState.selected)
              ? AppColors.surfaceElevated
              : AppColors.surface,
        ),
        foregroundColor: WidgetStateProperty.resolveWith(
          (states) => states.contains(WidgetState.selected)
              ? AppColors.brandAccent
              : AppColors.textSecondary,
        ),
        side: const WidgetStatePropertyAll(BorderSide(color: AppColors.border)),
        textStyle: const WidgetStatePropertyAll(
          TextStyle(fontSize: 13, fontWeight: FontWeight.w700),
        ),
      ),
    );

    final searchField = ValueListenableBuilder<TextEditingValue>(
      valueListenable: search,
      builder: (context, value, child) => TextField(
        autofocus: !wide,
        controller: search,
        textInputAction: TextInputAction.search,
        onChanged: onSearch,
        decoration: InputDecoration(
          isDense: true,
          hintText: 'Buscar na biblioteca',
          prefixIcon: const Icon(Icons.search_rounded, size: 18),
          suffixIcon: value.text.isEmpty
              ? null
              : IconButton(
                  icon: const Icon(Icons.clear_rounded, size: 18),
                  tooltip: 'Limpar busca',
                  onPressed: onClearSearch,
                ),
        ),
      ),
    );

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (wide)
          Row(
            children: [
              sections,
              const Spacer(),
              SizedBox(width: 270, child: searchField),
            ],
          )
        else ...[
          sections,
          if (showSearch) ...[const SizedBox(height: 8), searchField],
        ],
        if (!playing) ...[
          const SizedBox(height: 4),
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: Row(
              children: [
                for (final status in <GameStatus?>[
                  null,
                  GameStatus.planned,
                  GameStatus.completed,
                  GameStatus.dropped,
                ])
                  Padding(
                    padding: const EdgeInsets.only(right: 7),
                    child: ChoiceChip(
                      label: Text(status?.label ?? AppStrings.statusAll),
                      selected: selectedStatus == status,
                      showCheckmark: false,
                      onSelected: (_) => onSelectStatus(status),
                      backgroundColor: AppColors.surface,
                      selectedColor: AppColors.brandSurface,
                      shape: const StadiumBorder(),
                      visualDensity: VisualDensity.compact,
                      side: BorderSide(
                        color: selectedStatus == status
                            ? AppColors.brandAccent.withValues(alpha: .5)
                            : AppColors.border,
                      ),
                      labelStyle: TextStyle(
                        color: selectedStatus == status
                            ? AppColors.brandAccent
                            : AppColors.textSecondary,
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ),
              ],
            ),
          ),
        ],
      ],
    );
  }
}

class _CollectionMessage extends StatelessWidget {
  const _CollectionMessage({
    required this.state,
    required this.filtered,
    required this.onRetry,
    required this.onAdd,
    required this.onSearch,
  });

  final BacklogState state;
  final bool filtered;
  final VoidCallback onRetry;
  final VoidCallback onAdd;
  final VoidCallback onSearch;

  @override
  Widget build(BuildContext context) {
    if (state.isLoading) {
      return const Center(child: CircularProgressIndicator());
    }

    final error = state.errorMessage;
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(
            error != null
                ? Icons.cloud_off_rounded
                : filtered
                ? Icons.search_off_rounded
                : Icons.grid_view_rounded,
            color: error != null ? AppColors.error : AppColors.brandAccent,
            size: 34,
          ),
          const SizedBox(height: 12),
          Text(
            error ??
                (filtered
                    ? 'Nenhum jogo encontrado com os filtros atuais.'
                    : 'Sua biblioteca ainda está vazia.'),
            textAlign: TextAlign.center,
            style: const TextStyle(
              color: AppColors.textPrimary,
              fontSize: 16,
              fontWeight: FontWeight.w700,
            ),
          ),
          if (error != null) ...[
            const SizedBox(height: 16),
            OutlinedButton(
              onPressed: onRetry,
              child: const Text('Tentar novamente'),
            ),
          ] else if (!filtered) ...[
            const SizedBox(height: 16),
            Wrap(
              alignment: WrapAlignment.center,
              spacing: 10,
              runSpacing: 8,
              children: [
                OutlinedButton(
                  onPressed: onAdd,
                  child: const Text('Adicionar manual'),
                ),
                FilledButton(
                  onPressed: onSearch,
                  child: const Text('Buscar no Catálogo'),
                ),
              ],
            ),
          ],
        ],
      ),
    );
  }
}
