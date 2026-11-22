import 'package:flutter/material.dart';
import 'package:games_backlog/core/constants/app_colors.dart';
import 'package:games_backlog/features/backlog/presentation/widgets/game_cover_image.dart';
import 'package:games_backlog/features/catalog/data/models/catalog_models.dart';

class CatalogGameCard extends StatelessWidget {
  final CatalogGame game;
  final VoidCallback onImportTap;

  const CatalogGameCard({
    super.key,
    required this.game,
    required this.onImportTap,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: AppColors.surfaceCard,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(
          color: Colors.white.withValues(alpha: 0.08),
          width: 1,
        ),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.3),
            blurRadius: 12,
            offset: const Offset(0, 6),
          ),
        ],
      ),
      clipBehavior: Clip.antiAlias,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Expanded(
            child: Stack(
              fit: StackFit.expand,
              children: [
                GameCoverImage(
                  coverUrl: game.coverUrl,
                  title: game.title,
                  showPlaceholderTitle: false,
                  borderRadius: BorderRadius.zero,
                ),
                Positioned.fill(
                  child: DecoratedBox(
                    decoration: BoxDecoration(
                      gradient: LinearGradient(
                        begin: Alignment.center,
                        end: Alignment.bottomCenter,
                        colors: [
                          Colors.transparent,
                          AppColors.surfaceCard.withValues(alpha: 0.75),
                        ],
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),

          // Details & Import
          Padding(
            padding: const EdgeInsets.fromLTRB(12, 10, 12, 12),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  game.title,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w700,
                    letterSpacing: -0.2,
                    color: AppColors.textPrimary,
                  ),
                ),
                const SizedBox(height: 4),

                // Platform tags preview
                Text(
                  game.platforms.map((p) => p.name).join(' • '),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    fontSize: 11.5,
                    color: AppColors.textSecondary,
                  ),
                ),
                const SizedBox(height: 10),

                // Import Button
                SizedBox(
                  width: double.infinity,
                  child: FilledButton.tonalIcon(
                    onPressed: onImportTap,
                    icon: const Icon(Icons.add_rounded, size: 16),
                    label: const Text(
                      'Importar',
                      style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600),
                    ),
                    style: FilledButton.styleFrom(
                      backgroundColor: AppColors.brandSurface,
                      foregroundColor: AppColors.brandAccent,
                      padding: const EdgeInsets.symmetric(vertical: 8),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(20),
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
