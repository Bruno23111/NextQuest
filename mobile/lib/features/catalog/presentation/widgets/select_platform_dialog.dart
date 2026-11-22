import 'package:flutter/material.dart';
import 'package:games_backlog/core/constants/app_colors.dart';
import 'package:games_backlog/features/backlog/presentation/widgets/game_cover_image.dart';
import 'package:games_backlog/features/catalog/data/models/catalog_models.dart';

class SelectPlatformDialog extends StatefulWidget {
  final CatalogGame game;
  final Future<bool> Function(int platformId) onImport;

  const SelectPlatformDialog({
    super.key,
    required this.game,
    required this.onImport,
  });

  @override
  State<SelectPlatformDialog> createState() => _SelectPlatformDialogState();
}

class _SelectPlatformDialogState extends State<SelectPlatformDialog> {
  int? _selectedPlatformId;
  bool _isLoading = false;

  @override
  void initState() {
    super.initState();
    if (widget.game.platforms.isNotEmpty) {
      _selectedPlatformId = widget.game.platforms.first.id;
    }
  }

  Future<void> _handleImport() async {
    if (_selectedPlatformId == null) return;

    setState(() => _isLoading = true);
    final success = await widget.onImport(_selectedPlatformId!);

    if (mounted) {
      setState(() => _isLoading = false);
      if (success) {
        Navigator.of(context).pop(true);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Dialog(
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 440),
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // Header
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  SizedBox(
                    width: 50,
                    height: 65,
                    child: GameCoverImage(
                      coverUrl: widget.game.coverUrl,
                      title: widget.game.title,
                      borderRadius: BorderRadius.circular(6),
                    ),
                  ),
                  const SizedBox(width: 14),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text(
                          'Escolha a plataforma',
                          style: TextStyle(
                            fontSize: 18,
                            fontWeight: FontWeight.bold,
                            color: AppColors.textPrimary,
                          ),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          widget.game.title,
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(
                            fontSize: 13,
                            color: AppColors.textSecondary,
                          ),
                        ),
                      ],
                    ),
                  ),
                  IconButton(
                    icon: const Icon(Icons.close, size: 20),
                    onPressed: () => Navigator.of(context).pop(),
                  ),
                ],
              ),
              const SizedBox(height: 20),

              const Text(
                'Em qual plataforma você possui ou deseja jogar este título?',
                style: TextStyle(fontSize: 13, color: AppColors.textMuted),
              ),
              const SizedBox(height: 12),

              // Platforms List
              ConstrainedBox(
                constraints: const BoxConstraints(maxHeight: 220),
                child: SingleChildScrollView(
                  child: Column(
                    children: widget.game.platforms.map((platform) {
                      final isSelected = _selectedPlatformId == platform.id;
                      return Container(
                        margin: const EdgeInsets.only(bottom: 8),
                        decoration: BoxDecoration(
                          color: isSelected
                              ? AppColors.tealDark.withValues(alpha: 0.4)
                              : AppColors.surfaceCard,
                          borderRadius: BorderRadius.circular(8),
                          border: Border.all(
                            color: isSelected ? AppColors.cyanAccent : AppColors.border,
                            width: isSelected ? 1.5 : 1,
                          ),
                        ),
                        child: RadioListTile<int>(
                          value: platform.id,
                          groupValue: _selectedPlatformId,
                          onChanged: _isLoading
                              ? null
                              : (val) => setState(() => _selectedPlatformId = val),
                          title: Text(
                            platform.name,
                            style: TextStyle(
                              color: isSelected ? AppColors.cyanAccent : AppColors.textPrimary,
                              fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
                              fontSize: 14,
                            ),
                          ),
                          activeColor: AppColors.cyanAccent,
                          contentPadding: const EdgeInsets.symmetric(horizontal: 12),
                          dense: true,
                        ),
                      );
                    }).toList(),
                  ),
                ),
              ),
              const SizedBox(height: 24),

              // Actions
              Row(
                mainAxisAlignment: MainAxisAlignment.end,
                children: [
                  TextButton(
                    onPressed: _isLoading ? null : () => Navigator.of(context).pop(),
                    child: const Text('Cancelar'),
                  ),
                  const SizedBox(width: 12),
                  ElevatedButton(
                    onPressed: _isLoading || _selectedPlatformId == null ? null : _handleImport,
                    child: _isLoading
                        ? const SizedBox(
                            height: 18,
                            width: 18,
                            child: CircularProgressIndicator(strokeWidth: 2, color: Colors.black),
                          )
                        : const Text('Importar para Biblioteca'),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}
