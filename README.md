# NextQuest

[![Release](https://img.shields.io/badge/release-v0.1.0-blue.svg)](https://github.com/Bruno23111/Gamesbacklog/releases)
[![.NET](https://img.shields.io/badge/.NET-10.0-512BD4?logo=dotnet&logoColor=white)](https://dotnet.microsoft.com/)
[![C#](https://img.shields.io/badge/C%23-13.0-239120?logo=csharp&logoColor=white)](https://learn.microsoft.com/dotnet/csharp/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-18-4169E1?logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?logo=docker&logoColor=white)](https://www.docker.com/)
[![Flutter](https://img.shields.io/badge/Flutter-Android%20Beta-02569B?logo=flutter&logoColor=white)](mobile/README.md)
[![OpenAPI](https://img.shields.io/badge/OpenAPI-v1-85EA2D?logo=openapi-initiative&logoColor=black)](specs/openapi-v1.json)
[![CI](https://img.shields.io/badge/CI-GitHub%20Actions-2088FF?logo=github-actions&logoColor=white)](.github/workflows/api.yml)

> **NextQuest** é uma plataforma pessoal e privada de gerenciamento de backlog de jogos, oferecendo suporte a cadastro manual e importação enriquecida de metadados através da API da RAWG.

O repositório adota **desenvolvimento orientado a especificações (Spec-Driven)** com arquitetura limpa em **ASP.NET Core 10**, contrato OpenAPI versionado e especificação completa de cliente **Flutter para Android**.

---

### 🏷️ Tags & Tópicos do Projeto

`games-backlog` • `dotnet-10` • `csharp` • `aspnetcore` • `minimal-apis` • `postgresql` • `entity-framework-core` • `rawg-api` • `docker` • `flutter` • `riverpod` • `clean-architecture` • `openapi` • `spec-kit`

---

## 📑 Sumário

- [Visão Geral & Módulos](#-visão-geral--módulos)
- [Estrutura do Repositório](#-estrutura-do-repositório)
- [Endpoints da API](#-endpoints-da-api)
- [Pré-requisitos](#-pré-requisitos)
- [Desenvolvimento Local](#-desenvolvimento-local)
- [Testes Automatizados](#-testes-automatizados)
- [Especificações & Contratos](#-especificações--contratos)
- [Handoff Mobile (Flutter)](#-handoff-mobile-flutter)
- [Homologação & Deploy](#-homologação--deploy)
- [Notas e Termos de Uso](#-notas-e-termos-de-uso)

---

## 🚀 Visão Geral & Módulos

As especificações do projeto estão na pasta [`specs/`](specs/).

1. **Conta e Sessão ([Spec 001](specs/001-conta/spec.md))**
   - Cadastro seguro com confirmação via e-mail.
   - Autenticação e renovação de sessão com tokens opacos (*Bearer Tokens* do ASP.NET Core Identity).
   - Fluxo de recuperação e redefinição de senha com códigos seguros.
   - Rate limiting dedicado e e-mails locais via Mailpit.

2. **Biblioteca & Backlog ([Spec 002](specs/002-biblioteca/spec.md))**
   - Criação manual de itens no backlog com título e plataforma.
   - Status de jogo: *Quero Jogar*, *Jogando*, *Pausado*, *Zerado*, *Abandonado*.
   - Filtros por status, busca por texto e paginação.
   - Edição de status, notas e exclusão de itens com isolamento estrito por conta de usuário.

3. **Catálogo RAWG ([Spec 003](specs/003-catalogo/spec.md))**
   - Busca de jogos integrada ao catálogo global da RAWG.
   - Importação direta para o backlog com título, capa original e ID da plataforma.
   - Prevenção de duplicatas (status HTTP 409 em caso de importação duplicada).
   - Resiliência com fallback e rate limiting defensivo.

4. **Beta Android em Flutter ([Spec 004](specs/004-beta-android/spec.md))**
   - Especificação do aplicativo mobile multiplataforma (Android prioritário).
   - Tema escuro de alto contraste com capas de jogos em destaque.
   - Navegação inferior: *Biblioteca*, *Buscar* e *Conta*.
   - Detalhes de implementação e arquitetura em [mobile/README.md](mobile/README.md).

5. **Login Steam ([Spec 005](specs/005-login-steam/spec.md))** — Entrada e vínculo de conta via Steam.
6. **Biblioteca Steam ([Spec 006](specs/006-dados-steam/spec.md))** — Jogos, tempo jogado e progresso de conquistas.
7. **Perfil ([Spec 007](specs/007-perfil/spec.md))** — Nome de exibição, descrição, avatar e capa.

---

## 🗂️ Estrutura do Repositório

```text
Gamesbacklog/
├── .github/
│   └── workflows/api.yml        # Pipeline de Integração Contínua (CI)
├── .specify/                    # Memória de arquitetura e constituição Spec Kit
├── api/
│   ├── src/
│   │   ├── Domain/              # Entidades, Enums e regras de domínio
│   │   ├── Application/         # Casos de uso, interfaces de serviço e DTOs
│   │   ├── Infrastructure/      # EF Core, PostgreSQL, Identity e cliente RAWG
│   │   └── Api/                 # Minimal APIs, Endpoints, Middlewares e Program
│   ├── tests/
│   │   └── GamesBacklog.Tests/  # Testes unitários, de integração e snapshot OpenAPI
│   ├── Dockerfile               # Imagem de produção da API (.NET 10)
│   └── GamesBacklog.slnx        # Arquivo de solução moderno .NET
├── mobile/
│   └── README.md                # Diretrizes de implementação Flutter (Riverpod/Dio)
├── specs/
│   ├── 001-conta/               # Especificação de autenticação e identidade
│   ├── 002-biblioteca/          # Especificação do backlog pessoal
│   ├── 003-catalogo/            # Especificação da integração RAWG
│   ├── 004-beta-android/        # Especificação do cliente móvel Android
│   ├── examples/                # Fixtures e mocks JSON de requisições e respostas
│   └── openapi-v1.json          # Contrato OpenAPI v1 versionado
└── compose.yaml                 # PostgreSQL 18 e Mailpit para desenvolvimento local
```

---

## 📡 Endpoints da API

A API escuta por padrão em `/api/v1` e possui os seguintes grupos de rotas:

| Grupo | Método | Rota | Descrição |
|---|---|---|---|
| **Conta** | `POST` | `/api/v1/auth/register` | Cria uma nova conta |
| **Conta** | `GET` | `/api/v1/auth/confirmEmail` | Valida confirmação de e-mail |
| **Conta** | `POST` | `/api/v1/auth/login` | Realiza login e gera bearer token |
| **Conta** | `POST` | `/api/v1/auth/refresh` | Renova token expirado |
| **Conta** | `POST` | `/api/v1/auth/forgotPassword` | Solicita código de redefinição de senha |
| **Conta** | `POST` | `/api/v1/auth/resetPassword` | Aplica nova senha com o código |
| **Backlog** | `GET` | `/api/v1/backlog` | Lista itens do usuário com filtros e paginação |
| **Backlog** | `POST` | `/api/v1/backlog` | Cria manualmente um novo item no backlog |
| **Backlog** | `GET` | `/api/v1/backlog/{id}` | Obtém detalhes de um item |
| **Backlog** | `PATCH`| `/api/v1/backlog/{id}` | Atualiza status e metadados |
| **Backlog** | `DELETE`| `/api/v1/backlog/{id}` | Remove um item do backlog |
| **Backlog** | `POST` | `/api/v1/backlog/import` | Importa jogo a partir do catálogo RAWG |
| **Catálogo**| `GET` | `/api/v1/catalog/games` | Pesquisa títulos no catálogo RAWG |
| **Saúde** | `GET` | `/health` | Health check da aplicação |

---

## 🛠️ Pré-requisitos

- [.NET SDK 10.0+](https://dotnet.microsoft.com/download)
- [Docker](https://docs.docker.com/engine/install/) e [Docker Compose](https://docs.docker.com/compose/)
- [Chave de API RAWG](https://rawg.io/apidocs) *(opcional para rodar testes com mock; necessária para integração real do catálogo)*
- (Opcional) [Flutter SDK](https://docs.flutter.dev/get-started/install) para desenvolvimento do módulo móvel

---

## 💻 Desenvolvimento Local

### 1. Iniciar serviços de suporte

Inicie o banco de dados PostgreSQL e o servidor SMTP local (Mailpit):

```bash
docker compose up -d --wait
```

- **PostgreSQL**: `localhost:5432` (`gamesbacklog` / `local-dev-only`)
- **Mailpit Web UI**: [http://localhost:8025](http://localhost:8025) *(para visualizar e-mails de confirmação e recuperação)*

### 2. Executar migrações do banco

```bash
dotnet run --project api/src/Api -- --migrate
```

### 3. Iniciar a API

```bash
export ASPNETCORE_ENVIRONMENT=Development
# Opcional: configure sua chave RAWG para ativar o catálogo real
export Rawg__ApiKey="sua-chave-rawg"

dotnet run --project api/src/Api -- --urls http://127.0.0.1:5080
```

- Documentação OpenAPI / Swagger: [http://localhost:5080/openapi/v1.json](http://localhost:5080/openapi/v1.json)
- Health check: [http://localhost:5080/health](http://localhost:5080/health)

---

## 🧪 Testes Automatizados

Execute a suíte completa de testes unitários e de integração:

```bash
# Executa testes rápidos (in-memory / mocks)
dotnet test api/GamesBacklog.slnx

# Valida e sincroniza o snapshot do contrato OpenAPI
GAMESBACKLOG_EXPORT_OPENAPI="$PWD/specs/openapi-v1.json" \
  dotnet test api/GamesBacklog.slnx --filter FullyQualifiedName~OpenApiSnapshot
```

### Testes com PostgreSQL Real

Com o Docker Compose ativo, defina a variável `GAMESBACKLOG_TEST_POSTGRES` para executar os testes de concorrência e isolamento multi-tenant:

```bash
GAMESBACKLOG_TEST_POSTGRES="Host=localhost;Database=gamesbacklog;Username=gamesbacklog;Password=local-dev-only" \
  dotnet test api/GamesBacklog.slnx
```

---

## 📐 Especificações & Contratos

O projeto adota a metodologia de desenvolvimento dirigido por especificações do **GitHub Spec Kit**:

- **Constituição**: Regras centrais e diretrizes de design em [`.specify/memory/constitution.md`](.specify/memory/constitution.md).
- **Ciclo de Desenvolvimento**: `specify` → `clarify` → `plan` → `tasks` → `analyze` → `implement` → `converge`.
- **Contrato OpenAPI**: Mantido sob controle de versão em [`specs/openapi-v1.json`](specs/openapi-v1.json), validado continuamente pelo teste `OpenApiSnapshotMatchesEndpointMetadata`.
- **Exemplos de Payload**: Payloads de exemplo para desenvolvimento offline e mock em [`specs/examples/`](specs/examples/).

---

## 📱 Handoff Mobile (Flutter)

O diretório [`mobile/`](mobile/) contém as instruções para o desenvolvimento do aplicativo móvel Android em Flutter:

- Gerenciamento de estado: **Riverpod**
- Cliente HTTP: **Dio**
- Roteamento: **go_router**
- Configuração de URL base para desenvolvimento com emulador Android:
  ```bash
  flutter run --dart-define=API_BASE_URL=http://10.0.2.2:5080
  ```

Consulte [mobile/README.md](mobile/README.md) para orientações detalhadas sobre navegação, temas e tratamento de erros.

---

## 🚢 Homologação & Deploy

### Construção da imagem Docker

```bash
docker build -f api/Dockerfile -t gamesbacklog-api .
```

### Executar migrações em homologação

```bash
docker run --rm --env-file staging.env gamesbacklog-api --migrate
```

### Variáveis de ambiente principais

| Variável | Descrição | Exemplo |
|---|---|---|
| `ConnectionStrings__Backlog` | String de conexão com o PostgreSQL | `Host=db;Database=gamesbacklog;...` |
| `Auth__PublicOrigin` | Origem pública para links de e-mail | `https://api.gamesbacklog.com` |
| `Auth__KeyDirectory` | Diretório persistente para chaves de dados | `/var/keys` |
| `Smtp__Host` | Servidor SMTP para disparo de e-mails | `smtp.provedor.com` |
| `Smtp__Port` | Porta SMTP | `587` |
| `Smtp__From` | Remetente de e-mails do sistema | `noreply@gamesbacklog.com` |
| `Rawg__ApiKey` | Chave de integração do catálogo RAWG | `abc123xyz` |
| `Proxy__KnownAddress` | IP do proxy reverso para terminação TLS | `10.0.0.1` |

---

## ⚠️ Notas e Termos de Uso

- **Catálogo RAWG**: O plano gratuito é destinado ao desenvolvimento e uso pessoal. Antes de qualquer monetização ou distribuição comercial, confirme os termos em [Planos RAWG](https://rawg.io/apidocs) e [Termos da API RAWG](https://rawg.io/tos_api).
- **Segurança de Tokens**: Os tokens de autenticação gerados pelo ASP.NET Core Identity são opacos e protegidos criptograficamente. Certifique-se de configurar um volume persistente para `Auth__KeyDirectory` em ambientes produtivos.

## Login com Steam

A integração usa Steam OpenID 2.0 para entrar ou vincular uma conta existente. A configuração usa a origem da API em `Auth__PublicOrigin` e a rota do app em `Steam__WebReturnUrl`. O ambiente de desenvolvimento aponta para `http://127.0.0.1:5080` e `https://localhost:4200/auth/steam/callback` (Angular). Configure URLs HTTPS no ambiente de homologação. Em proxy reverso, preserve o cabeçalho Host e encaminhe o protocolo original conforme a configuração de proxy da API.

Aplique as migrations antes de usar os endpoints. A origem da URL Flutter configurada é liberada para requisições do navegador. A autenticação guarda o SteamID verificado e usa a sessão bearer do GamesBacklog. Quem já tem biblioteca vinculada a um e-mail deve entrar por e-mail e então vincular a Steam para preservar a mesma conta.

O [guia Flutter](specs/005-login-steam/flutter.md) detalha o retorno do navegador e a troca de código. O login via navegador usa o OpenID Steam e dispensa chave da Steam Web API. [Documentação Steamworks](https://partner.steamgames.com/doc/features/auth)
