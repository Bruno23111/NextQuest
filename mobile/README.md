# NextQuest Flutter

Handoff para o Gemini. Desenvolva o aplicativo nesta pasta para Android, com interface em português. Use os [critérios de aceite](../specs/), o [OpenAPI](../specs/openapi-v1.json) e os [exemplos JSON](../specs/examples/) como referência do comportamento.

## Estrutura

- `lib/features/auth/` para login, cadastro, confirmação pendente, recuperação e sessão.
- `lib/features/backlog/` para lista, busca, filtros, formulário manual e detalhes.
- `lib/features/catalog/` para busca RAWG e seleção de plataforma.
- Use Riverpod para estado e injeção de repositórios, Dio para HTTP e go_router para rotas. Compartilhe tema, cliente HTTP e armazenamento seguro de credenciais em `lib/core/`. Troque repositórios simulados por HTTP na composição do app.

## Interface

Use tema escuro, contraste legível e capas em destaque. A navegação inferior tem **Biblioteca**, **Buscar** e **Conta**. A Biblioteca mostra filtros de status e ação **Adicionar manualmente**. Use placeholder com título legível quando a capa estiver ausente. Mostre um link para RAWG nas telas com dados importados.

Mostre carregamento, vazios e erros. Mostre feedback após salvar, editar e excluir. Diferencie conflito de importação (409) da indisponibilidade do catálogo (503). Traduza os valores de status em rótulos e mantenha os valores originais ao enviar requisições.

## Integração

Use `--dart-define=API_BASE_URL=https://api.exemplo.com` e preserve `/api/v1` nas rotas do OpenAPI. Para o emulador Android local, use `http://10.0.2.2:5080` com tráfego HTTP permitido apenas no build de desenvolvimento. A confirmação abre no navegador pelo link do e-mail e a recuperação usa o código colado no app. Os tokens são opacos.

Execute `flutter analyze`, testes unitários e de widgets. Cubra login, renovação, filtros, vazios, atualização de status, duplicata e indisponibilidade. Valide os fluxos de [beta Android](../specs/004-beta-android/spec.md) contra a homologação.
