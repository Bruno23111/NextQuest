import 'package:flutter/material.dart';
import 'package:games_backlog/core/constants/app_colors.dart';
import 'package:games_backlog/core/constants/app_strings.dart';
import 'package:games_backlog/core/utils/platform_utils.dart';

class RawgAttribution extends StatelessWidget {
  final bool compact;

  const RawgAttribution({super.key, this.compact = false});

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: () => PlatformUtils.openExternalUrl(AppStrings.rawgUrl),
      borderRadius: BorderRadius.circular(8),
      child: Container(
        padding: EdgeInsets.symmetric(horizontal: 12, vertical: compact ? 6 : 10),
        decoration: BoxDecoration(
          color: AppColors.surfaceElevated.withValues(alpha: 0.6),
          borderRadius: BorderRadius.circular(8),
          border: Border.all(color: AppColors.border),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.public_rounded, size: 16, color: AppColors.cyanAccent),
            const SizedBox(width: 8),
            Text(
              AppStrings.rawgCredit,
              style: TextStyle(
                color: AppColors.cyanAccent,
                fontSize: compact ? 12 : 13,
                fontWeight: FontWeight.w600,
              ),
            ),
            const SizedBox(width: 4),
            const Icon(Icons.arrow_outward_rounded, size: 14, color: AppColors.cyanAccent),
          ],
        ),
      ),
    );
  }
}
