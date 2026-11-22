import 'package:flutter/material.dart';
import 'package:games_backlog/core/constants/app_colors.dart';

class AddGameDialog extends StatefulWidget {
  final Future<bool> Function(String title, String platform) onAdd;

  const AddGameDialog({super.key, required this.onAdd});

  @override
  State<AddGameDialog> createState() => _AddGameDialogState();
}

class _AddGameDialogState extends State<AddGameDialog> {
  final _formKey = GlobalKey<FormState>();
  final _titleController = TextEditingController();
  final _platformController = TextEditingController();
  bool _isLoading = false;

  final List<String> _commonPlatforms = [
    'PC',
    'PlayStation 5',
    'PlayStation 4',
    'Xbox Series X',
    'Xbox One',
    'Nintendo Switch',
    'Mobile',
  ];

  @override
  void dispose() {
    _titleController.dispose();
    _platformController.dispose();
    super.dispose();
  }

  Future<void> _handleSubmit() async {
    if (!_formKey.currentState!.validate()) return;

    setState(() => _isLoading = true);
    final success = await widget.onAdd(
      _titleController.text.trim(),
      _platformController.text.trim(),
    );

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
          child: Form(
            key: _formKey,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Text(
                      'Adicionar manualmente',
                      style: TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.bold,
                        color: AppColors.textPrimary,
                      ),
                    ),
                    IconButton(
                      icon: const Icon(Icons.close, size: 20),
                      onPressed: () => Navigator.of(context).pop(),
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                const Text(
                  'Cadastre um jogo informando o título e a plataforma. O jogo iniciará com status "Quero jogar".',
                  style: TextStyle(
                    fontSize: 13,
                    color: AppColors.textSecondary,
                  ),
                ),
                const SizedBox(height: 20),

                // Title
                TextFormField(
                  controller: _titleController,
                  textInputAction: TextInputAction.next,
                  autofocus: true,
                  decoration: const InputDecoration(
                    labelText: 'Título do jogo',
                    hintText: 'Ex: Chrono Trigger',
                    prefixIcon: Icon(Icons.gamepad_outlined),
                  ),
                  validator: (val) {
                    if (val == null || val.trim().isEmpty) {
                      return 'Informe o título do jogo';
                    }
                    return null;
                  },
                ),
                const SizedBox(height: 16),

                // Platform
                TextFormField(
                  controller: _platformController,
                  textInputAction: TextInputAction.done,
                  onFieldSubmitted: (_) => _handleSubmit(),
                  decoration: const InputDecoration(
                    labelText: 'Plataforma',
                    hintText: 'Ex: PC, PlayStation 5, Switch',
                    prefixIcon: Icon(Icons.devices_outlined),
                  ),
                  validator: (val) {
                    if (val == null || val.trim().isEmpty) {
                      return 'Informe a plataforma';
                    }
                    return null;
                  },
                ),
                const SizedBox(height: 12),

                // Platform suggestions chips
                Wrap(
                  spacing: 6,
                  runSpacing: 6,
                  children: _commonPlatforms.map((plat) {
                    return ActionChip(
                      label: Text(plat, style: const TextStyle(fontSize: 11)),
                      backgroundColor: AppColors.surfaceCard,
                      side: const BorderSide(color: AppColors.border),
                      onPressed: () {
                        _platformController.text = plat;
                      },
                    );
                  }).toList(),
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
                      onPressed: _isLoading ? null : _handleSubmit,
                      child: _isLoading
                          ? const SizedBox(
                              height: 18,
                              width: 18,
                              child: CircularProgressIndicator(strokeWidth: 2, color: Colors.black),
                            )
                          : const Text('Adicionar'),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
