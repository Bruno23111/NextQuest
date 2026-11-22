# Plano 008

## Arquitetura do Frontend (`web/`)

- **Framework**: Angular (standalone components, Signals, `HttpClient` com interceptors para Bearer token e refresh automático, Angular Router com guards de autenticação).
- **Estilização**: CSS/SCSS com design tokens dedicados inspirados no template Steam Redesign (Dribbble #26698011), organizados em tema escuro de alto contraste e layout responsivo.
- **Organização por feature**:
  - `core/` — configuração de ambiente (`apiUrl`), cliente HTTP, interceptors de auth/erros (`ProblemDetails`), serviço de sessão/tokens.
  - `features/auth/` — login, registro, confirmação de e-mail, recuperação de senha e callback Steam (`/auth/steam/callback`).
  - `features/backlog/` — biblioteca pessoal, filtros por status, busca, criação manual, detalhes, edição e exclusão.
  - `features/catalog/` — busca RAWG e importação para o backlog.
  - `features/steam/` — biblioteca Steam, tempo de jogo e conquistas.
  - `features/profile/` — visualização e edição de perfil com pré-visualização.
  - `shared/` — shell principal (sidebar/topbar conforme template), cards de jogo, estados vazios/carregamento e feedback de erro.

## Integração local com a API

- Proxy de desenvolvimento Angular (`proxy.conf.json`) ou CORS configurado via `Steam:WebReturnUrl` na API para apontar para o frontend local sem expor segredos no repositório.
