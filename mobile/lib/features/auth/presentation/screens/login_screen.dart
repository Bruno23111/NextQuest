import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:games_backlog/core/utils/platform_utils.dart';
import 'package:go_router/go_router.dart';
import 'package:games_backlog/core/config/env_config.dart';
import 'package:games_backlog/core/constants/app_colors.dart';
import 'package:games_backlog/core/constants/app_strings.dart';
import 'package:games_backlog/core/widgets/nextquest_logo.dart';
import 'package:games_backlog/features/auth/presentation/controllers/auth_controller.dart';

class LoginScreen extends ConsumerStatefulWidget {
  const LoginScreen({super.key});

  @override
  ConsumerState<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends ConsumerState<LoginScreen> {
  final _formKey = GlobalKey<FormState>();
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  bool _obscurePassword = true;

  @override
  void initState() {
    super.initState();
    if (EnvConfig.useMockApi) {
      _emailController.text = 'jogadora@example.org';
      _passwordController.text = 'senha-de-exemplo';
    }
  }

  @override
  void dispose() {
    _emailController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  Future<void> _handleLogin() async {
    if (!_formKey.currentState!.validate()) return;

    final success = await ref.read(authControllerProvider.notifier).login(
      _emailController.text,
      _passwordController.text,
    );

    if (success && mounted) {
      context.go('/library');
    }
  }

  Future<void> _handleSteamLogin() async {
    final flow = await ref.read(authControllerProvider.notifier).initiateSteamFlow();
    if (!mounted || flow == null) return;

    if (EnvConfig.useMockApi) {
      final success = await ref.read(authControllerProvider.notifier).completeSteamLogin(
            stateParam: flow.$1.state,
            code: 'mock-code',
            codeVerifier: flow.$2.codeVerifier,
          );
      if (!mounted) return;
      if (success) {
        context.go('/library');
      }
    } else {
      final opened = await PlatformUtils.openExternalUrl(flow.$1.authorizationUrl, sameTabOnWeb: true);
      if (!opened && mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Não foi possível abrir a página da Steam.')),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final authState = ref.watch(authControllerProvider);
    final isLoading = authState.status == AuthStatus.loading;

    return Scaffold(
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 32),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 420),
              child: Form(
                key: _formKey,
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Center(
                      child: Container(
                        padding: const EdgeInsets.all(14),
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          gradient: RadialGradient(
                            colors: [
                              AppColors.cyanAccent.withValues(alpha: 0.22),
                              Colors.transparent,
                            ],
                          ),
                        ),
                        child: const NextQuestLogo(size: 72),
                      ),
                    ),
                    const SizedBox(height: 16),
                    const Text(
                      AppStrings.appTitle,
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        fontSize: 30,
                        fontWeight: FontWeight.w800,
                        letterSpacing: -0.7,
                        color: AppColors.textPrimary,
                      ),
                    ),
                    const SizedBox(height: 6),
                    const Text(
                      'Sua biblioteca pessoal e catálogo de jogos',
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        fontSize: 14,
                        color: AppColors.textSecondary,
                      ),
                    ),
                    const SizedBox(height: 28),

                    // Error Alert
                    if (authState.errorMessage != null) ...[
                      Container(
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          color: AppColors.error.withValues(alpha: 0.12),
                          borderRadius: BorderRadius.circular(10),
                          border: Border.all(color: AppColors.error.withValues(alpha: 0.4)),
                        ),
                        child: Row(
                          children: [
                            const Icon(Icons.error_outline_rounded, color: AppColors.error, size: 20),
                            const SizedBox(width: 10),
                            Expanded(
                              child: Text(
                                authState.errorMessage!,
                                style: const TextStyle(color: AppColors.error, fontSize: 13),
                              ),
                            ),
                            IconButton(
                              icon: const Icon(Icons.close, size: 16, color: AppColors.error),
                              onPressed: () => ref.read(authControllerProvider.notifier).clearError(),
                              padding: EdgeInsets.zero,
                              constraints: const BoxConstraints(),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 20),
                    ],

                    // Email Input
                    TextFormField(
                      controller: _emailController,
                      keyboardType: TextInputType.emailAddress,
                      textInputAction: TextInputAction.next,
                      decoration: const InputDecoration(
                        labelText: 'E-mail',
                        hintText: 'exemplo@dominio.com',
                        prefixIcon: Icon(Icons.email_outlined),
                      ),
                      validator: (val) {
                        if (val == null || val.trim().isEmpty) {
                          return 'Informe seu e-mail';
                        }
                        if (!val.contains('@')) {
                          return 'Informe um e-mail válido';
                        }
                        return null;
                      },
                    ),
                    const SizedBox(height: 16),

                    // Password Input
                    TextFormField(
                      controller: _passwordController,
                      obscureText: _obscurePassword,
                      textInputAction: TextInputAction.done,
                      onFieldSubmitted: (_) => _handleLogin(),
                      decoration: InputDecoration(
                        labelText: 'Senha',
                        hintText: '••••••••',
                        prefixIcon: const Icon(Icons.lock_outline_rounded),
                        suffixIcon: IconButton(
                          icon: Icon(
                            _obscurePassword ? Icons.visibility_outlined : Icons.visibility_off_outlined,
                          ),
                          onPressed: () => setState(() => _obscurePassword = !_obscurePassword),
                        ),
                      ),
                      validator: (val) {
                        if (val == null || val.isEmpty) {
                          return 'Informe sua senha';
                        }
                        return null;
                      },
                    ),
                    const SizedBox(height: 12),

                    // Forgot Password link
                    Align(
                      alignment: Alignment.centerRight,
                      child: TextButton(
                        onPressed: isLoading ? null : () => context.push('/auth/forgot-password'),
                        child: const Text('Esqueci minha senha'),
                      ),
                    ),
                    const SizedBox(height: 16),

                    // Submit Button
                    ElevatedButton(
                      onPressed: isLoading ? null : _handleLogin,
                      child: isLoading
                          ? const SizedBox(
                              height: 20,
                              width: 20,
                              child: CircularProgressIndicator(strokeWidth: 2, color: Colors.black),
                            )
                          : const Text('Entrar'),
                    ),
                    const SizedBox(height: 14),

                    // Steam Login Button
                    OutlinedButton.icon(
                      onPressed: isLoading ? null : _handleSteamLogin,
                      icon: const Icon(Icons.sports_esports_rounded, size: 20, color: AppColors.cyanAccent),
                      label: const Text('Entrar com Steam'),
                      style: OutlinedButton.styleFrom(
                        padding: const EdgeInsets.symmetric(vertical: 14),
                        side: const BorderSide(color: AppColors.tealLight, width: 1.2),
                      ),
                    ),
                    const SizedBox(height: 20),

                    // Register link
                    Wrap(
                      alignment: WrapAlignment.center,
                      crossAxisAlignment: WrapCrossAlignment.center,
                      children: [
                        const Text(
                          'Ainda não tem conta?',
                          style: TextStyle(color: AppColors.textSecondary, fontSize: 14),
                        ),
                        TextButton(
                          onPressed: isLoading ? null : () => context.push('/auth/register'),
                          child: const Text('Criar conta'),
                        ),
                      ],
                    ),

                    // Resend confirmation link
                    Center(
                      child: TextButton.icon(
                        onPressed: isLoading ? null : () => context.push('/auth/pending-confirmation'),
                        icon: const Icon(Icons.mark_email_unread_outlined, size: 16),
                        label: const Text(
                          'Reenviar link de confirmação',
                          style: TextStyle(fontSize: 13),
                        ),
                      ),
                    ),

                    // Demo mode banner
                    if (EnvConfig.useMockApi) ...[
                      const SizedBox(height: 16),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                        decoration: BoxDecoration(
                          color: AppColors.tealDark.withValues(alpha: 0.3),
                          borderRadius: BorderRadius.circular(8),
                          border: Border.all(color: AppColors.tealLight.withValues(alpha: 0.3)),
                        ),
                        child: const Row(
                          children: [
                            Icon(Icons.info_outline, size: 16, color: AppColors.cyanAccent),
                            SizedBox(width: 8),
                            Expanded(
                              child: Text(
                                'Modo demonstração ativo (dados mockados)',
                                style: TextStyle(fontSize: 11, color: AppColors.cyanAccent),
                              ),
                            ),
                          ],
                        ),
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
