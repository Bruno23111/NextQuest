# 007 Personalização do perfil

Na aba Conta, a pessoa configura o nome de exibição, uma descrição, a imagem de perfil e a imagem de capa. O perfil mostra uma prévia das alterações. As imagens são informadas por URL HTTPS.

## Aceite

- A API retorna e atualiza o perfil da conta autenticada.
- Nome de exibição, descrição, avatar e capa são persistidos sem alterar as credenciais ou a sessão.
- Nome tem até 60 caracteres; descrição até 300; URLs de imagem até 2048 caracteres e precisam usar HTTPS.
- A tela Conta mostra avatar, capa, nome e descrição salvos.
- O editor permite pré-visualizar e salvar as alterações.

## Upload no Angular

A rota autenticada `PUT /api/v1/profile/images` recebe nome, descrição e arquivos opcionais de avatar e capa em `multipart/form-data`. Aceita PNG, JPEG e WebP de até 2 MB por arquivo. Campos de imagem omitidos preservam as imagens existentes. Os arquivos enviados são armazenados no PostgreSQL.
