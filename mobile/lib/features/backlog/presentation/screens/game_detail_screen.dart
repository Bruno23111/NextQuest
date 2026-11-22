import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:games_backlog/core/constants/app_colors.dart';
import 'package:games_backlog/core/constants/app_strings.dart';
import 'package:games_backlog/core/models/game_status.dart';
import 'package:games_backlog/core/utils/platform_utils.dart';
import 'package:games_backlog/features/backlog/presentation/controllers/backlog_controller.dart';
import 'package:games_backlog/features/backlog/data/models/backlog_models.dart';
import 'package:games_backlog/features/backlog/presentation/widgets/game_cover_image.dart';
import 'package:games_backlog/features/backlog/presentation/widgets/status_badge.dart';

class GameDetailScreen extends ConsumerStatefulWidget {
  final String gameId;
  final BacklogGame? initialGame;

  const GameDetailScreen({super.key, required this.gameId, this.initialGame});

  @override
  ConsumerState<GameDetailScreen> createState() => _GameDetailScreenState();
}

class _GameDetailScreenState extends ConsumerState<GameDetailScreen> {
  BacklogGame? _game;
  bool _isLoading = false;
  bool _isSavingStatus = false;
  String? _errorMessage;

  @override
  void initState() {
    super.initState();
    _game = widget.initialGame;
    if (_game == null) {
      _loadGame();
    }
  }

  Future<void> _loadGame() async {
    setState(() => _isLoading = true);
    try {
      final repo = ref.read(backlogRepositoryProvider);
      final game = await repo.getGameById(widget.gameId);
      if (mounted) {
        setState(() {
          _game = game;
          _isLoading = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _errorMessage = e.toString();
          _isLoading = false;
        });
      }
    }
  }

  Future<void> _updateStatus(GameStatus newStatus) async {
    if (_game == null || _game!.status == newStatus) return;

    setState(() => _isSavingStatus = true);
    final success = await ref
        .read(backlogControllerProvider.notifier)
        .updateGameStatus(_game!.id, newStatus);

    if (mounted) {
      setState(() {
        _isSavingStatus = false;
        if (success) {
          _game = _game!.copyWith(status: newStatus);
        }
      });
      if (success) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Status alterado para "${newStatus.label}".'),
            backgroundColor: AppColors.success,
          ),
        );
      }
    }
  }

  Future<void> _confirmDelete() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Remover jogo'),
        content: Text(
          'Tem certeza que deseja remover "${_game?.title}" da sua biblioteca?',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(false),
            child: const Text('Cancelar'),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: AppColors.error),
            onPressed: () => Navigator.of(ctx).pop(true),
            child: const Text('Excluir', style: TextStyle(color: Colors.white)),
          ),
        ],
      ),
    );

    if (confirmed == true && mounted) {
      final success = await ref
          .read(backlogControllerProvider.notifier)
          .deleteGame(widget.gameId);
      if (success && mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Jogo removido da biblioteca.'),
            backgroundColor: AppColors.success,
          ),
        );
        context.pop();
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_isLoading) {
      return const Scaffold(
        body: Center(
          child: CircularProgressIndicator(color: AppColors.cyanAccent),
        ),
      );
    }

    if (_errorMessage != null || _game == null) {
      return Scaffold(
        appBar: AppBar(),
        body: Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.error_outline, size: 48, color: AppColors.error),
              const SizedBox(height: 16),
              Text(_errorMessage ?? 'Jogo não encontrado.'),
              const SizedBox(height: 16),
              ElevatedButton(
                onPressed: _loadGame,
                child: const Text('Tentar novamente'),
              ),
            ],
          ),
        ),
      );
    }

    final game = _game!;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Detalhes do jogo'),
        actions: [
          IconButton(
            icon: const Icon(
              Icons.delete_outline_rounded,
              color: AppColors.error,
            ),
            tooltip: 'Excluir jogo',
            onPressed: _confirmDelete,
          ),
        ],
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
        child: Center(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 920),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                _GameDetailsBanner(game: game),
                Padding(
                  padding: const EdgeInsets.only(top: 22),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      // Status Selector Card
                      Card(
                        child: Padding(
                          padding: const EdgeInsets.all(16),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(
                                mainAxisAlignment:
                                    MainAxisAlignment.spaceBetween,
                                children: [
                                  const Text(
                                    'Status na biblioteca',
                                    style: TextStyle(
                                      fontSize: 16,
                                      fontWeight: FontWeight.bold,
                                      color: AppColors.textPrimary,
                                    ),
                                  ),
                                  if (_isSavingStatus)
                                    const SizedBox(
                                      width: 16,
                                      height: 16,
                                      child: CircularProgressIndicator(
                                        strokeWidth: 2,
                                        color: AppColors.cyanAccent,
                                      ),
                                    ),
                                ],
                              ),
                              const SizedBox(height: 14),
                              Wrap(
                                spacing: 8,
                                runSpacing: 8,
                                children: GameStatus.values.map((s) {
                                  final isCurrent = game.status == s;
                                  return ChoiceChip(
                                    label: Text(s.label),
                                    selected: isCurrent,
                                    onSelected: _isSavingStatus
                                        ? null
                                        : (_) => _updateStatus(s),
                                    avatar: Icon(
                                      s.icon,
                                      size: 16,
                                      color: isCurrent ? Colors.black : s.color,
                                    ),
                                    selectedColor: s.color,
                                    backgroundColor: AppColors.surfaceElevated,
                                    labelStyle: TextStyle(
                                      color: isCurrent
                                          ? Colors.black
                                          : AppColors.textPrimary,
                                      fontWeight: isCurrent
                                          ? FontWeight.bold
                                          : FontWeight.normal,
                                    ),
                                  );
                                }).toList(),
                              ),
                            ],
                          ),
                        ),
                      ),
                      const SizedBox(height: 20),

                      // Information Card
                      Card(
                        child: Padding(
                          padding: const EdgeInsets.all(16),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              const Text(
                                'Detalhes',
                                style: TextStyle(
                                  fontSize: 16,
                                  fontWeight: FontWeight.bold,
                                  color: AppColors.textPrimary,
                                ),
                              ),
                              const SizedBox(height: 12),
                              _buildInfoRow('Plataforma', game.platform),
                              const Divider(height: 20),
                              _buildInfoRow(
                                'Origem',
                                game.isImportedFromRawg
                                    ? 'Catálogo RAWG'
                                    : 'Cadastro Manual',
                              ),
                              const Divider(height: 20),
                              _buildInfoRow(
                                'Adicionado em',
                                '${game.createdAt.day.toString().padLeft(2, '0')}/${game.createdAt.month.toString().padLeft(2, '0')}/${game.createdAt.year}',
                              ),
                              if (game.isImportedFromRawg) ...[
                                const Divider(height: 20),
                                _buildInfoRow(
                                  'RAWG ID',
                                  game.rawgId.toString(),
                                ),
                              ],
                            ],
                          ),
                        ),
                      ),

                      // RAWG Attribution Credit (Required for imported games)
                      if (game.isImportedFromRawg) ...[
                        const SizedBox(height: 20),
                        InkWell(
                          onTap: () =>
                              PlatformUtils.openExternalUrl(AppStrings.rawgUrl),
                          borderRadius: BorderRadius.circular(10),
                          child: Container(
                            padding: const EdgeInsets.all(14),
                            decoration: BoxDecoration(
                              color: AppColors.surfaceCard,
                              borderRadius: BorderRadius.circular(10),
                              border: Border.all(color: AppColors.border),
                            ),
                            child: const Row(
                              children: [
                                Icon(
                                  Icons.open_in_new_rounded,
                                  size: 18,
                                  color: AppColors.cyanAccent,
                                ),
                                SizedBox(width: 10),
                                Expanded(
                                  child: Text(
                                    AppStrings.rawgCredit,
                                    style: TextStyle(
                                      color: AppColors.cyanAccent,
                                      fontSize: 13,
                                      fontWeight: FontWeight.w600,
                                    ),
                                  ),
                                ),
                                Text(
                                  'rawg.io',
                                  style: TextStyle(
                                    color: AppColors.textMuted,
                                    fontSize: 12,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildInfoRow(String label, String value) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Flexible(
          child: Text(
            label,
            style: const TextStyle(
              color: AppColors.textSecondary,
              fontSize: 14,
            ),
          ),
        ),
        const SizedBox(width: 12),
        Flexible(
          child: Text(
            value,
            textAlign: TextAlign.end,
            style: const TextStyle(
              color: AppColors.textPrimary,
              fontWeight: FontWeight.w600,
              fontSize: 14,
            ),
          ),
        ),
      ],
    );
  }
}

class _GameDetailsBanner extends StatelessWidget {
  const _GameDetailsBanner({required this.game});

  final BacklogGame game;

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final wide = constraints.maxWidth >= 630;
        return ClipRRect(
          borderRadius: BorderRadius.circular(24),
          child: Stack(
            children: [
              Positioned.fill(
                child: GameCoverImage(
                  coverUrl: game.coverUrl,
                  title: game.title,
                  showPlaceholderTitle: false,
                  borderRadius: BorderRadius.zero,
                ),
              ),
              const Positioned.fill(
                child: DecoratedBox(
                  decoration: BoxDecoration(
                    gradient: LinearGradient(
                      begin: Alignment.topCenter,
                      end: Alignment.bottomCenter,
                      colors: [Color(0x22101113), Color(0xE7101113)],
                    ),
                  ),
                ),
              ),
              Container(
                alignment: Alignment.bottomLeft,
                constraints: BoxConstraints(minHeight: wide ? 308 : 226),
                padding: EdgeInsets.fromLTRB(
                  wide ? 30 : 18,
                  90,
                  18,
                  wide ? 26 : 18,
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    StatusBadge(status: game.status),
                    const SizedBox(height: 10),
                    Text(
                      game.title,
                      style: TextStyle(
                        color: AppColors.textPrimary,
                        fontSize: wide ? 42 : 29,
                        fontWeight: FontWeight.w800,
                        height: 1.08,
                        letterSpacing: -.8,
                      ),
                    ),
                    const SizedBox(height: 6),
                    Text(
                      game.platform,
                      style: const TextStyle(color: AppColors.textSecondary),
                    ),
                  ],
                ),
              ),
            ],
          ),
        );
      },
    );
  }
}
