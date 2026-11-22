import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:games_backlog/core/config/env_config.dart';
import 'package:games_backlog/core/constants/app_colors.dart';
import 'package:games_backlog/core/models/api_error.dart';
import 'package:games_backlog/features/auth/presentation/controllers/auth_controller.dart';
import 'package:games_backlog/features/steam/data/models/steam_models.dart';
import 'package:games_backlog/features/steam/data/steam_repository.dart';
import 'package:games_backlog/features/steam/data/steam_repository_http.dart';
import 'package:games_backlog/features/steam/data/steam_repository_mock.dart';

final steamRepositoryProvider = Provider<SteamRepository>((ref) {
  if (EnvConfig.useMockApi) return SteamRepositoryMock();
  return SteamRepositoryHttp(apiClient: ref.watch(apiClientProvider));
});

final steamLibraryProvider = FutureProvider.autoDispose<SteamLibrary>((ref) =>
    ref.watch(steamRepositoryProvider).getLibrary());

class SteamLibraryScreen extends ConsumerWidget {
  const SteamLibraryScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final library = ref.watch(steamLibraryProvider);
    return Scaffold(
      appBar: AppBar(
        title: const Text('Minha biblioteca'),
        actions: [
          IconButton(
            tooltip: 'Meu backlog',
            onPressed: () => context.go('/library/backlog'),
            icon: const Icon(Icons.bookmark_border_rounded),
          ),
          IconButton(
            tooltip: 'Atualizar',
            onPressed: () => ref.invalidate(steamLibraryProvider),
            icon: const Icon(Icons.refresh_rounded),
          ),
        ],
      ),
      body: library.when(
        loading: () => const Center(child: CircularProgressIndicator(color: AppColors.cyanAccent)),
        error: (error, _) => _SteamError(
          message: error is AppApiException ? error.message : error.toString(),
          onRetry: () => ref.invalidate(steamLibraryProvider),
        ),
        data: (data) => data.games.isEmpty
            ? const Center(child: Text('Nenhum jogo visível na biblioteca Steam.'))
            : Center(
                child: ConstrainedBox(
                  constraints: const BoxConstraints(maxWidth: 900),
                  child: Column(
                    children: [
                      Padding(
                        padding: const EdgeInsets.fromLTRB(20, 16, 20, 8),
                        child: Row(
                          children: [
                            const Icon(Icons.sports_esports_rounded, color: AppColors.cyanAccent),
                            const SizedBox(width: 10),
                            Text('${data.gameCount} jogos na Steam', style: Theme.of(context).textTheme.titleMedium),
                          ],
                        ),
                      ),
                      Expanded(
                        child: ListView.separated(
                          padding: const EdgeInsets.all(16),
                          itemCount: data.games.length,
                          separatorBuilder: (_, _) => const SizedBox(height: 8),
                          itemBuilder: (context, index) => _SteamGameTile(game: data.games[index]),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
      ),
    );
  }
}

class _SteamGameTile extends ConsumerWidget {
  final SteamLibraryGame game;

  const _SteamGameTile({required this.game});

  @override
  Widget build(BuildContext context, WidgetRef ref) => Card(
        child: ListTile(
          leading: game.iconUrl == null
              ? const CircleAvatar(child: Icon(Icons.videogame_asset_rounded))
              : CircleAvatar(backgroundImage: NetworkImage(game.iconUrl!)),
          title: Text(game.name, maxLines: 1, overflow: TextOverflow.ellipsis),
          subtitle: Text('Tempo jogado: ${game.playtimeLabel}'),
          trailing: const Icon(Icons.emoji_events_outlined, color: AppColors.cyanAccent),
          onTap: () => _showAchievements(context, ref, game),
        ),
      );

  Future<void> _showAchievements(BuildContext context, WidgetRef ref, SteamLibraryGame game) async {
    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      builder: (context) => SafeArea(
        child: SizedBox(
          height: MediaQuery.sizeOf(context).height * 0.72,
          child: FutureBuilder<SteamGameAchievements>(
            future: ref.read(steamRepositoryProvider).getAchievements(game.appId),
            builder: (context, snapshot) {
              if (snapshot.hasError) {
                final error = snapshot.error;
                return _SteamError(
                  message: error is AppApiException ? error.message : error.toString(),
                  onRetry: () {},
                  compact: true,
                );
              }
              if (!snapshot.hasData) {
                return const Center(child: CircularProgressIndicator(color: AppColors.cyanAccent));
              }

              final stats = snapshot.data!;
              final progress = stats.totalCount == 0 ? 0.0 : stats.unlockedCount / stats.totalCount;
              return Column(
                children: [
                  Padding(
                    padding: const EdgeInsets.fromLTRB(20, 16, 12, 12),
                    child: Row(
                      children: [
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(stats.gameName, style: Theme.of(context).textTheme.titleLarge),
                              const SizedBox(height: 4),
                              Text('${stats.unlockedCount} de ${stats.totalCount} conquistas'),
                              const SizedBox(height: 8),
                              ClipRRect(
                                borderRadius: BorderRadius.circular(8),
                                child: LinearProgressIndicator(
                                  value: progress.clamp(0.0, 1.0),
                                  minHeight: 7,
                                  backgroundColor: AppColors.surfaceElevated,
                                  color: AppColors.cyanAccent,
                                ),
                              ),
                            ],
                          ),
                        ),
                        IconButton(onPressed: () => Navigator.pop(context), icon: const Icon(Icons.close)),
                      ],
                    ),
                  ),
                  const Divider(height: 1),
                  Expanded(
                    child: stats.achievements.isEmpty
                        ? const Center(child: Text('Este jogo não disponibiliza conquistas pela Steam.'))
                        : ListView.separated(
                            padding: const EdgeInsets.all(16),
                            itemCount: stats.achievements.length,
                            separatorBuilder: (_, _) => const Divider(height: 1),
                            itemBuilder: (context, index) => _AchievementTile(achievement: stats.achievements[index]),
                          ),
                  ),
                ],
              );
            },
          ),
        ),
      ),
    );
  }
}

class _AchievementTile extends StatelessWidget {
  final SteamAchievement achievement;

  const _AchievementTile({required this.achievement});

  @override
  Widget build(BuildContext context) {
    final iconUrl = achievement.achieved ? achievement.iconUrl : achievement.grayIconUrl;
    return ListTile(
      contentPadding: const EdgeInsets.symmetric(vertical: 4),
      leading: iconUrl == null
          ? Icon(achievement.achieved ? Icons.emoji_events : Icons.lock_outline,
              color: achievement.achieved ? AppColors.cyanAccent : AppColors.textMuted)
          : Image.network(iconUrl, width: 42, height: 42, errorBuilder: (_, _, _) =>
              const Icon(Icons.emoji_events_outlined, color: AppColors.textMuted)),
      title: Text(achievement.name),
      subtitle: achievement.description == null ? null : Text(achievement.description!),
      trailing: Icon(achievement.achieved ? Icons.check_circle : Icons.lock_outline,
          color: achievement.achieved ? AppColors.success : AppColors.textMuted, size: 20),
    );
  }
}

class _SteamError extends StatelessWidget {
  final String message;
  final VoidCallback onRetry;
  final bool compact;

  const _SteamError({required this.message, required this.onRetry, this.compact = false});

  @override
  Widget build(BuildContext context) => Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.cloud_off_rounded, size: 42, color: AppColors.warning),
              const SizedBox(height: 12),
              Text(message, textAlign: TextAlign.center),
              if (!compact) ...[
                const SizedBox(height: 16),
                OutlinedButton.icon(onPressed: onRetry, icon: const Icon(Icons.refresh), label: const Text('Tentar novamente')),
                if (!EnvConfig.useMockApi) ...[
                  const SizedBox(height: 8),
                  const Text(
                    'A biblioteca exige conta Steam vinculada, perfil/jogos públicos e Steam:ApiKey configurada na API.',
                    textAlign: TextAlign.center,
                    style: TextStyle(color: AppColors.textSecondary, fontSize: 12),
                  ),
                ],
              ],
            ],
          ),
        ),
      );
}
