import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:games_backlog/core/constants/app_colors.dart';
import 'package:games_backlog/core/models/api_error.dart';
import 'package:games_backlog/features/profile/data/models/user_profile.dart';
import 'package:games_backlog/features/profile/presentation/controllers/profile_controller.dart';

class EditProfileScreen extends ConsumerWidget {
  const EditProfileScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final profile = ref.watch(userProfileProvider);
    return Scaffold(
      appBar: AppBar(title: const Text('Editar perfil')),
      body: profile.when(
        loading: () => const Center(child: CircularProgressIndicator(color: AppColors.cyanAccent)),
        error: (error, _) => Center(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Text(error is AppApiException ? error.message : error.toString(), textAlign: TextAlign.center),
          ),
        ),
        data: (profile) => _ProfileForm(profile: profile),
      ),
    );
  }
}

class _ProfileForm extends ConsumerStatefulWidget {
  final UserProfile profile;

  const _ProfileForm({required this.profile});

  @override
  ConsumerState<_ProfileForm> createState() => _ProfileFormState();
}

class _ProfileFormState extends ConsumerState<_ProfileForm> {
  final _formKey = GlobalKey<FormState>();
  late final TextEditingController _name;
  late final TextEditingController _bio;
  late final TextEditingController _avatar;
  late final TextEditingController _header;
  bool _saving = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _name = TextEditingController(text: widget.profile.displayName);
    _bio = TextEditingController(text: widget.profile.bio ?? '');
    _avatar = TextEditingController(text: widget.profile.avatarUrl ?? '');
    _header = TextEditingController(text: widget.profile.headerUrl ?? '');
    for (final controller in [_name, _bio, _avatar, _header]) {
      controller.addListener(_refreshPreview);
    }
  }

  @override
  void dispose() {
    _name.dispose();
    _bio.dispose();
    _avatar.dispose();
    _header.dispose();
    super.dispose();
  }

  void _refreshPreview() {
    if (mounted) setState(() {});
  }

  Future<void> _save() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      await ref.read(profileRepositoryProvider).updateProfile(UpdateUserProfile(
            displayName: _name.text.trim(),
            bio: _bio.text.trim(),
            avatarUrl: _avatar.text.trim(),
            headerUrl: _header.text.trim(),
          ));
      ref.invalidate(userProfileProvider);
      if (mounted) Navigator.of(context).pop(true);
    } catch (error) {
      setState(() {
        _saving = false;
        _error = error is AppApiException ? error.message : error.toString();
      });
    }
  }

  @override
  Widget build(BuildContext context) => Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 680),
          child: Form(
            key: _formKey,
            child: ListView(
              padding: const EdgeInsets.all(20),
              children: [
                _ProfilePreview(
                  displayName: _name.text.isEmpty ? 'Seu nome' : _name.text,
                  bio: _bio.text,
                  avatarUrl: _avatar.text,
                  headerUrl: _header.text,
                ),
                const SizedBox(height: 24),
                TextFormField(
                  controller: _name,
                  maxLength: 60,
                  decoration: const InputDecoration(labelText: 'Nome', prefixIcon: Icon(Icons.person_outline)),
                  validator: (value) => value == null || value.trim().isEmpty ? 'Informe seu nome.' : null,
                ),
                const SizedBox(height: 12),
                TextFormField(
                  controller: _bio,
                  maxLength: 300,
                  minLines: 2,
                  maxLines: 4,
                  decoration: const InputDecoration(
                    labelText: 'Descrição',
                    hintText: 'Conte um pouco sobre você e seus jogos favoritos.',
                    alignLabelWithHint: true,
                    prefixIcon: Icon(Icons.notes_rounded),
                  ),
                ),
                const SizedBox(height: 12),
                TextFormField(
                  controller: _avatar,
                  keyboardType: TextInputType.url,
                  decoration: const InputDecoration(
                    labelText: 'URL da imagem de perfil',
                    hintText: 'https://...',
                    prefixIcon: Icon(Icons.account_circle_outlined),
                  ),
                  validator: _validateImageUrl,
                ),
                const SizedBox(height: 12),
                TextFormField(
                  controller: _header,
                  keyboardType: TextInputType.url,
                  decoration: const InputDecoration(
                    labelText: 'URL da imagem de capa',
                    hintText: 'https://...',
                    prefixIcon: Icon(Icons.panorama_outlined),
                  ),
                  validator: _validateImageUrl,
                ),
                const SizedBox(height: 8),
                const Text(
                  'Use links HTTPS diretos para as imagens. Você pode deixar os campos de imagem vazios.',
                  style: TextStyle(color: AppColors.textSecondary, fontSize: 12),
                ),
                if (_error != null) ...[
                  const SizedBox(height: 16),
                  Text(_error!, style: const TextStyle(color: AppColors.error)),
                ],
                const SizedBox(height: 24),
                FilledButton.icon(
                  onPressed: _saving ? null : _save,
                  icon: _saving
                      ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2))
                      : const Icon(Icons.check_rounded),
                  label: Text(_saving ? 'Salvando…' : 'Salvar perfil'),
                ),
              ],
            ),
          ),
        ),
      );

  String? _validateImageUrl(String? value) {
    if (value == null || value.trim().isEmpty) return null;
    final uri = Uri.tryParse(value.trim());
    return uri != null && uri.isAbsolute && uri.scheme == 'https' && uri.userInfo.isEmpty
        ? null
        : 'Informe uma URL HTTPS válida.';
  }
}

class _ProfilePreview extends StatelessWidget {
  final String displayName;
  final String bio;
  final String avatarUrl;
  final String headerUrl;

  const _ProfilePreview({
    required this.displayName,
    required this.bio,
    required this.avatarUrl,
    required this.headerUrl,
  });

  @override
  Widget build(BuildContext context) => Card(
        clipBehavior: Clip.antiAlias,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            SizedBox(
              height: 140,
              width: double.infinity,
              child: headerUrl.trim().isEmpty
                  ? const ColoredBox(color: AppColors.surfaceElevated, child: Icon(Icons.panorama_outlined, size: 42))
                  : Image.network(headerUrl.trim(), fit: BoxFit.cover,
                      errorBuilder: (_, _, _) => const ColoredBox(color: AppColors.surfaceElevated,
                          child: Icon(Icons.broken_image_outlined, size: 42))),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(18, 0, 18, 18),
              child: Transform.translate(
                offset: const Offset(0, -32),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    Container(
                      padding: const EdgeInsets.all(3),
                      decoration: const BoxDecoration(color: AppColors.surfaceCard, shape: BoxShape.circle),
                      child: CircleAvatar(
                        radius: 36,
                        backgroundColor: AppColors.tealDark,
                        backgroundImage: avatarUrl.trim().isEmpty ? null : NetworkImage(avatarUrl.trim()),
                        onBackgroundImageError: avatarUrl.trim().isEmpty ? null : (_, _) {},
                        child: avatarUrl.trim().isEmpty ? const Icon(Icons.person_rounded, size: 38) : null,
                      ),
                    ),
                    const SizedBox(width: 14),
                    Expanded(
                      child: Padding(
                        padding: const EdgeInsets.only(bottom: 7),
                        child: Text(displayName, maxLines: 1, overflow: TextOverflow.ellipsis,
                            style: Theme.of(context).textTheme.titleLarge),
                      ),
                    ),
                  ],
                ),
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(18, 0, 18, 18),
              child: Text(bio.isEmpty ? 'Sua descrição aparecerá aqui.' : bio,
                  style: const TextStyle(color: AppColors.textSecondary)),
            ),
          ],
        ),
      );
}
