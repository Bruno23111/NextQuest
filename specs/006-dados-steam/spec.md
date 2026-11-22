# 006 Dados da biblioteca Steam

Com a conta Steam vinculada, a pessoa consulta sua biblioteca na aba principal, incluindo tempo jogado e conquistas por jogo. O backlog pessoal continua disponível dentro da área Biblioteca. A API guarda a chave Web API da Steam apenas no servidor. Os dados dependem das permissões de privacidade da conta e da disponibilidade de conquistas para cada jogo.

## Aceite

- As rotas de biblioteca e conquistas exigem autenticação GamesBacklog.
- As consultas usam o SteamID vinculado à conta autenticada; o cliente nunca envia SteamID de outra pessoa nem recebe a chave Web API.
- A biblioteca exibe jogos e minutos jogados, ordenados por tempo total.
- As conquistas informam quantas foram desbloqueadas e listam estado, descrição e ícones disponíveis.
- Uma conta sem Steam vinculado recebe uma resposta clara para vincular a conta.
- Dados privados ou indisponíveis retornam erro compreensível sem expor detalhes internos da Steam.

## Rotas

- `GET /api/v1/steam/library`
- `GET /api/v1/steam/games/{appId}/achievements`

Configuração server-side: `Steam:ApiKey` (variável de ambiente `Steam__ApiKey`).
