import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:games_backlog/core/constants/app_colors.dart';
import 'package:games_backlog/features/auth/presentation/controllers/auth_controller.dart';

class PendingConfirmationScreen extends ConsumerStatefulWidget {
  final String? initialEmail;

  const PendingConfirmationScreen({super.key, this.initialEmail});

  @override
  ConsumerState<PendingConfirmationScreen> createState() => _PendingConfirmationScreenState();
}

class _PendingConfirmationScreenState extends ConsumerState<PendingConfirmationScreen> {
  late final TextEditingController _emailController;
  bool _feedbackSent = false;

  @override
  void initState() {
    super.initState();
    _emailController = TextEditingController(text: widget.initialEmail ?? '');
  }

  @override
  void dispose() {
    _emailController.dispose();
    super.dispose();
  }

  Future<void> _handleResend() async {
    final email = _emailController.text.trim();
    if (email.isEmpty || !email.contains('@')) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Informe um e-mail válido para reenviar.')),
      );
      return;
    }

    final success = await ref.read(authControllerProvider.notifier).resendConfirmationEmail(email);
    if (success && mounted) {
      setState(() => _feedbackSent = true);
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Link de confirmação reenviado! Verifique sua caixa de entrada.'),
          backgroundColor: AppColors.success,
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final authState = ref.watch(authControllerProvider);
    final isLoading = authState.status == AuthStatus.loading;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Confirmação pendente'),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () => context.go('/auth/login'),
        ),
      ),
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 32),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 440),
              child: Card(
                child: Padding(
                  padding: const EdgeInsets.all(28),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Container(
                        padding: const EdgeInsets.all(16),
                        decoration: BoxDecoration(
                          color: AppColors.tealDark.withValues(alpha: 0.4),
                          shape: BoxShape.circle,
                        ),
                        child: const Icon(
                          Icons.mark_email_read_rounded,
                          color: AppColors.cyanAccent,
                          size: 48,
                        ),
                      ),
                      const SizedBox(height: 20),
                      const Text(
                        'Verifique seu e-mail',
                        textAlign: TextAlign.center,
                        style: TextStyle(
                          fontSize: 22,
                          fontWeight: FontWeight.bold,
                          color: AppColors.textPrimary,
                        ),
                      ),
                      const SizedBox(height: 12),
                      const Text(
                        'Enviamos um link de confirmação para o seu endereço de e-mail. '
                        'Abra o link no navegador para ativar sua conta e retornar ao app.',
                        textAlign: TextAlign.center,
                        style: TextStyle(
                          fontSize: 14,
                          color: AppColors.textSecondary,
                          height: 1.4,
                        ),
                      ),
                      if (kDebugMode) ...[
                        const SizedBox(height: 12),
                        const Text(
                          'No ambiente local, abra http://127.0.0.1:8025 para acessar o Mailpit. '
                          'As mensagens ficam lá e não são entregues à sua caixa de e-mail real.',
                          textAlign: TextAlign.center,
                          style: TextStyle(
                            fontSize: 12,
                            color: AppColors.cyanAccent,
                            height: 1.4,
                          ),
                        ),
                      ],
                      const SizedBox(height: 28),

                      TextField(
                        controller: _emailController,
                        keyboardType: TextInputType.emailAddress,
                        decoration: const InputDecoration(
                          labelText: 'E-mail para reenvio',
                          prefixIcon: Icon(Icons.email_outlined),
                        ),
                      ),
                      const SizedBox(height: 16),

                      SizedBox(
                        width: double.infinity,
                        child: OutlinedButton.icon(
                          onPressed: isLoading ? null : _handleResend,
                          icon: isLoading
                              ? const SizedBox(
                                  height: 16,
                                  width: 16,
                                  child: CircularProgressIndicator(strokeWidth: 2),
                                )
                              : const Icon(Icons.send_rounded, size: 18),
                          label: Text(_feedbackSent ? 'Reenviar novamente' : 'Reenviar link de confirmação'),
                        ),
                      ),
                      const SizedBox(height: 16),

                      SizedBox(
                        width: double.infinity,
                        child: ElevatedButton(
                          onPressed: () => context.go('/auth/login'),
                          child: const Text('Já confirmei, ir para o login'),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
