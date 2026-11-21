# Constituição do GamesBacklog

## Princípios

### I. Contrato antes da integração

A API e o app compartilham o OpenAPI versionado e exemplos de sucesso e erro. Toda alteração de contrato atualiza os artefatos e os testes correspondentes na mesma revisão.

### II. Privacidade por conta

O servidor identifica o dono pela sessão. Leituras e escritas são restritas à conta autenticada. Credenciais e tokens ficam fora do Git e dos logs.

### III. Responsabilidades claras

O Codex mantém a API C# em Clean Architecture. O Gemini mantém o Flutter organizado por feature. O código de domínio da API contém as regras de negócio. A integração com catálogo, banco e e-mail fica na infraestrutura.

### IV. Entregas verificáveis

Cada feature tem especificação, plano, tarefas e critérios de aceite. A API usa testes HTTP e PostgreSQL para validar contratos e restrições de dados. O app valida os fluxos em Android antes do beta.

## Governança

Os arquivos em `specs/` orientam implementação e revisão. Mudanças de escopo ou contrato passam pela especificação antes de chegar à implementação.

**Versão** 1.0.0 · **Ratificação** 2026-11-21 · **Última alteração** 2026-11-21
