import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:games_backlog/core/constants/app_colors.dart';
import 'package:games_backlog/features/auth/presentation/controllers/auth_controller.dart';
import 'package:go_router/go_router.dart';

class SteamCallbackScreen extends ConsumerStatefulWidget {
  final String? stateParam;
  final String? code;
  final String? error;

  const SteamCallbackScreen({
    super.key,
    this.stateParam,
    this.code,
    this.error,
  });

  @override
  ConsumerState<SteamCallbackScreen> createState() => _SteamCallbackScreenState();
}

class _SteamCallbackScreenState extends ConsumerState<SteamCallbackScreen> {
  String? _statusMessage;
  bool _isLoading = true;
  bool _hasError = false;

  @override
  void initState() {
    super.initState();
    _handleCallback();
  }

  Future<void> _handleCallback() async {
    final storage = ref.read(sessionStorageProvider);
    final pending = await storage.getPendingSteamAuth();
    await storage.clearPendingSteamAuth();

    if (widget.error != null && widget.error!.isNotEmpty) {
      setState(() {
        _isLoading = false;
        _hasError = true;
        _statusMessage = widget.error == 'cancelled'
            ? 'Autenticação Steam cancelada pelo usuário.'
            : 'Resposta inválida recebida da Steam (${widget.error}).';
      });
      return;
    }

    final code = widget.code;
    final stateParam = widget.stateParam;

    if (code == null || stateParam == null || pending == null || pending.state != stateParam) {
      setState(() {
        _isLoading = false;
        _hasError = true;
        _statusMessage = 'Solicitação de autenticação Steam inválida ou expirada.';
      });
      return;
    }

    setState(() => _statusMessage = 'Validando retorno da Steam...');

    final notifier = ref.read(authControllerProvider.notifier);
    final success = pending.isLink
        ? await notifier.completeSteamLink(
            stateParam: stateParam,
            code: code,
            codeVerifier: pending.codeVerifier,
          )
        : await notifier.completeSteamLogin(
            stateParam: stateParam,
            code: code,
            codeVerifier: pending.codeVerifier,
          );

    if (mounted) {
      setState(() {
        _isLoading = false;
        if (!success) {
          _hasError = true;
          _statusMessage = ref.read(authControllerProvider).errorMessage ??
              'Falha ao trocar o código de autenticação Steam.';
        }
      });

      if (success) {
        context.go(pending.isLink ? '/account' : '/library');
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 420),
            child: Card(
              child: Padding(
                padding: const EdgeInsets.all(24),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    if (_isLoading) ...[
                      const CircularProgressIndicator(color: AppColors.cyanAccent),
                      const SizedBox(height: 20),
                      Text(
                        _statusMessage ?? 'Processando autenticação Steam...',
                        textAlign: TextAlign.center,
                        style: const TextStyle(color: AppColors.textPrimary),
                      ),
                    ] else if (_hasError) ...[
                      const Icon(Icons.error_outline_rounded, color: AppColors.error, size: 48),
                      const SizedBox(height: 16),
                      const Text(
                        'Falha na autenticação Steam',
                        style: TextStyle(
                          fontSize: 18,
                          fontWeight: FontWeight.bold,
                          color: AppColors.textPrimary,
                        ),
                      ),
                      const SizedBox(height: 8),
                      Text(
                        _statusMessage ?? 'Ocorreu um erro ao processar o retorno.',
                        textAlign: TextAlign.center,
                        style: const TextStyle(color: AppColors.textSecondary, fontSize: 13),
                      ),
                      const SizedBox(height: 20),
                      ElevatedButton(
                        onPressed: () => context.go('/auth/login'),
                        child: const Text('Voltar ao login'),
                      ),
                    ] else ...[
                      const Icon(Icons.check_circle_outline_rounded, color: AppColors.success, size: 48),
                      const SizedBox(height: 16),
                      const Text(
                        'Autenticado com sucesso!',
                        style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                      ),
                    ],
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
