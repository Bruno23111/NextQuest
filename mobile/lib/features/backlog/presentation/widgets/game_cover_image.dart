import 'package:flutter/material.dart';
import 'package:games_backlog/core/constants/app_colors.dart';

class GameCoverImage extends StatelessWidget {
  final String? coverUrl;
  final String title;
  final double? width;
  final double? height;
  final BorderRadius? borderRadius;
  final BoxFit fit;
  final bool showPlaceholderTitle;

  const GameCoverImage({
    super.key,
    this.coverUrl,
    required this.title,
    this.width,
    this.height,
    this.borderRadius,
    this.fit = BoxFit.cover,
    this.showPlaceholderTitle = true,
  });

  @override
  Widget build(BuildContext context) {
    final effectiveBorderRadius = borderRadius ?? BorderRadius.circular(10);

    if (coverUrl != null && coverUrl!.isNotEmpty) {
      return ClipRRect(
        borderRadius: effectiveBorderRadius,
        child: Image.network(
          coverUrl!,
          width: width,
          height: height,
          fit: fit,
          errorBuilder: (context, error, stackTrace) => _buildPlaceholder(),
          loadingBuilder: (context, child, progress) {
            if (progress == null) return child;
            return Container(
              width: width,
              height: height,
              color: AppColors.surfaceElevated,
              child: const Center(
                child: SizedBox(
                  width: 20,
                  height: 20,
                  child: CircularProgressIndicator(
                    strokeWidth: 2,
                    color: AppColors.cyanAccent,
                  ),
                ),
              ),
            );
          },
        ),
      );
    }

    return _buildPlaceholder(borderRadius: effectiveBorderRadius);
  }

  Widget _buildPlaceholder({BorderRadius? borderRadius}) {
    return Container(
      width: width,
      height: height,
      decoration: BoxDecoration(
        borderRadius: borderRadius ?? BorderRadius.circular(10),
        gradient: LinearGradient(
          colors: [AppColors.surfaceElevated, AppColors.brandSurface],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        border: Border.all(color: AppColors.border),
      ),
      padding: const EdgeInsets.all(6),
      child: Center(
        child: showPlaceholderTitle
            ? Column(
                mainAxisAlignment: MainAxisAlignment.center,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(
                    Icons.sports_esports_rounded,
                    size: (height != null && height! < 120) ? 24 : 36,
                    color: AppColors.cyanAccent.withValues(alpha: 0.6),
                  ),
                  const SizedBox(height: 4),
                  Flexible(
                    child: Text(
                      title,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      textAlign: TextAlign.center,
                      style: const TextStyle(
                        color: AppColors.textPrimary,
                        fontSize: 11,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ),
                ],
              )
            : const Icon(
                Icons.sports_esports_outlined,
                size: 34,
                color: AppColors.brandAccent,
              ),
      ),
    );
  }
}
