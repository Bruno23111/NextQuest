import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:games_backlog/core/utils/platform_utils.dart';
import 'package:go_router/go_router.dart';
import 'package:games_backlog/core/config/env_config.dart';
import 'package:games_backlog/core/constants/app_colors.dart';
import 'package:games_backlog/core/constants/app_strings.dart';
import 'package:games_backlog/features/auth/presentation/controllers/auth_controller.dart';
import 'package:games_backlog/features/profile/data/models/user_profile.dart';
import 'package:games_backlog/features/profile/presentation/controllers/profile_controller.dart';

class AccountScreen extends ConsumerWidget {
  const AccountScreen({super.key});

  Future<void> _handleLogout(BuildContext context, WidgetRef ref) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Sair da conta'),
        content: const Text('Deseja realmente sair? Os dados da sessão serão removidos deste aparelho.'),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(false),
            child: const Text('Cancelar'),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: AppColors.error),
            onPressed: () => Navigator.of(ctx).pop(true),
            child: const Text('Sair', style: TextStyle(color: Colors.white)),
          ),
        ],
      ),
    );

    if (confirmed == true) {
      await ref.read(authControllerProvider.notifier).logout();
      if (context.mounted) {
        context.go('/auth/login');
      }
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final authState = ref.watch(authControllerProvider);
    final email = authState.email;

    return Scaffold(
      appBar: AppBar(
        title: const Text(AppStrings.account),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(20),
        child: Center(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 600),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                _ProfileCard(
                  email: email,
                  onEdit: () => context.push('/account/profile'),
                ),
                const SizedBox(height: 20),

                // Environment & Configuration Info
                Card(
                  child: Padding(
                    padding: const EdgeInsets.all(16),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text(
                          'Ambiente e Conexão',
                          style: TextStyle(
                            fontSize: 15,
                            fontWeight: FontWeight.bold,
                            color: AppColors.textPrimary,
                          ),
                        ),
                        const SizedBox(height: 12),
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            const Text('Modo', style: TextStyle(color: AppColors.textSecondary, fontSize: 13)),
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                              decoration: BoxDecoration(
                                color: EnvConfig.useMockApi
                                    ? AppColors.tealDark.withValues(alpha: 0.5)
                                    : AppColors.success.withValues(alpha: 0.2),
                                borderRadius: BorderRadius.circular(4),
                              ),
                              child: Text(
                                EnvConfig.useMockApi ? 'Demonstração (Mock)' : 'API Real',
                                style: TextStyle(
                                  color: EnvConfig.useMockApi ? AppColors.cyanAccent : AppColors.success,
                                  fontSize: 12,
                                  fontWeight: FontWeight.w600,
                                ),
                              ),
                            ),
                          ],
                        ),
                        const Divider(height: 20),
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            const Text('API Base URL', style: TextStyle(color: AppColors.textSecondary, fontSize: 13)),
                            Flexible(
                              child: Text(
                                EnvConfig.useMockApi ? 'In-Memory Mock' : EnvConfig.apiBaseUrl,
                                style: const TextStyle(
                                  color: AppColors.textPrimary,
                                  fontSize: 12,
                                  fontFamily: 'monospace',
                                ),
                                overflow: TextOverflow.ellipsis,
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 20),

                // Account Actions
                Card(
                  child: Column(
                    children: [
                      ListTile(
                        leading: const Icon(Icons.sports_esports_rounded, color: AppColors.cyanAccent),
                        title: const Text('Vincular Steam'),
                        subtitle: const Text('Importar seus jogos, horas e conquistas', style: TextStyle(fontSize: 12)),
                        trailing: const Icon(Icons.chevron_right_rounded),
                        onTap: () async {
                          final flow = await ref
                              .read(authControllerProvider.notifier)
                              .initiateSteamFlow(isLink: true);
                          if (flow != null && context.mounted) {
                            if (EnvConfig.useMockApi) {
                              final success = await ref
                                  .read(authControllerProvider.notifier)
                                  .completeSteamLink(
                                    stateParam: flow.$1.state,
                                    code: 'mock-link-code',
                                    codeVerifier: flow.$2.codeVerifier,
                                  );
                              if (context.mounted && success) {
                                ScaffoldMessenger.of(context).showSnackBar(
                                  const SnackBar(
                                    content: Text('Conta Steam vinculada com sucesso!'),
                                    backgroundColor: AppColors.success,
                                  ),
                                );
                              }
                            } else {
                              await PlatformUtils.openExternalUrl(
                                flow.$1.authorizationUrl,
                                sameTabOnWeb: true,
                              );
                            }
                          }
                        },
                      ),
                      const Divider(height: 1),
                      ListTile(
                        leading: const Icon(Icons.mark_email_unread_outlined, color: AppColors.cyanAccent),
                        title: const Text('Reenviar e-mail de confirmação'),
                        subtitle: const Text('Caso precise confirmar em outro navegador', style: TextStyle(fontSize: 12)),
                        trailing: const Icon(Icons.chevron_right_rounded),
                        onTap: () => context.push('/auth/pending-confirmation'),
                      ),
                      const Divider(height: 1),
                      ListTile(
                        leading: const Icon(Icons.lock_reset_rounded, color: AppColors.cyanAccent),
                        title: const Text('Redefinir senha com código'),
                        subtitle: const Text('Usar código de recuperação recebido', style: TextStyle(fontSize: 12)),
                        trailing: const Icon(Icons.chevron_right_rounded),
                        onTap: () => context.push('/auth/reset-password'),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 28),

                // Logout Button
                OutlinedButton.icon(
                  onPressed: () => _handleLogout(context, ref),
                  style: OutlinedButton.styleFrom(
                    foregroundColor: AppColors.error,
                    side: const BorderSide(color: AppColors.error, width: 1.2),
                    padding: const EdgeInsets.symmetric(vertical: 14),
                  ),
                  icon: const Icon(Icons.logout_rounded, size: 20),
                  label: const Text('Sair da conta'),
                ),
                const SizedBox(height: 28),

                // Version
                const Center(
                  child: Text(
                    '${AppStrings.appTitle} v1.0.0',
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      color: AppColors.textMuted,
                      fontSize: 12,
                    ),
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

class _ProfileCard extends ConsumerWidget {
  final String? email;
  final VoidCallback onEdit;

  const _ProfileCard({required this.email, required this.onEdit});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final profile = ref.watch(userProfileProvider);
    return profile.when(
      loading: () => const Card(
        child: SizedBox(height: 170, child: Center(child: CircularProgressIndicator())),
      ),
      error: (_, _) => _card(context, null),
      data: (profile) => _card(context, profile),
    );
  }

  Widget _card(BuildContext context, UserProfile? profile) => Card(
        clipBehavior: Clip.antiAlias,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            SizedBox(
              height: 118,
              child: profile?.headerUrl == null
                  ? const DecoratedBox(
                      decoration: BoxDecoration(
                        gradient: LinearGradient(
                          colors: [AppColors.tealDark, AppColors.surfaceElevated],
                          begin: Alignment.topLeft,
                          end: Alignment.bottomRight,
                        ),
                      ),
                    )
                  : Image.network(
                      profile!.headerUrl!,
                      fit: BoxFit.cover,
                      errorBuilder: (_, _, _) => const ColoredBox(color: AppColors.surfaceElevated),
                    ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(18, 0, 12, 16),
              child: Transform.translate(
                offset: const Offset(0, -30),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    Container(
                      padding: const EdgeInsets.all(3),
                      decoration: const BoxDecoration(color: AppColors.surfaceCard, shape: BoxShape.circle),
                      child: CircleAvatar(
                        radius: 34,
                        backgroundColor: AppColors.tealDark,
                        backgroundImage: profile?.avatarUrl == null ? null : NetworkImage(profile!.avatarUrl!),
                        onBackgroundImageError: profile?.avatarUrl == null ? null : (_, _) {},
                        child: profile?.avatarUrl == null
                            ? const Icon(Icons.person_rounded, size: 38, color: AppColors.cyanAccent)
                            : null,
                      ),
                    ),
                    const SizedBox(width: 14),
                    Expanded(
                      child: Padding(
                        padding: const EdgeInsets.only(bottom: 6),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              profile?.displayName ?? email ?? 'Conta ${AppStrings.appTitle}',
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: const TextStyle(fontSize: 17, fontWeight: FontWeight.bold),
                            ),
                            const SizedBox(height: 4),
                            Text(email ?? 'Sessão ativa',
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: const TextStyle(color: AppColors.textSecondary, fontSize: 12)),
                          ],
                        ),
                      ),
                    ),
                    IconButton.filledTonal(
                      tooltip: 'Editar perfil',
                      onPressed: onEdit,
                      icon: const Icon(Icons.edit_outlined),
                    ),
                  ],
                ),
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(18, 0, 18, 18),
              child: Text(
                profile?.bio?.isNotEmpty == true ? profile!.bio! : 'Adicione uma descrição ao seu perfil.',
                style: const TextStyle(color: AppColors.textSecondary),
              ),
            ),
          ],
        ),
      );
}
