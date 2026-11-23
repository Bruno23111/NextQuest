# 010 Compartilhar no Discord

Uma conta configura ou desconecta um webhook de canal no Perfil. A API guarda a credencial protegida e retorna somente o estado da integração.

Nos detalhes de um jogo zerado ou de uma conquista Steam desbloqueada, o usuário vê uma prévia e confirma o envio ao canal. O servidor verifica os dados na conta autenticada. O envio é manual e não inclui diário ou dados de login.

## Vínculo pelo Discord

A conta autenticada inicia OAuth2 com o escopo `identify`. O perfil exibe o nome e o avatar retornados pelo Discord. Para escolher ou trocar de canal, o fluxo pede também `webhook.incoming`. Um Discord só pode ser associado a uma conta NextQuest. Desvincular remove a identidade e o canal salvos no NextQuest.

### Configuração local

Crie um aplicativo no [Discord Developer Portal](https://discord.com/developers/applications). Em OAuth2, registre a URL de retorno do Angular `https://localhost:4200/profile`. A URL precisa coincidir com a origem usada para abrir o navegador e com `Discord__RedirectUri`.

Defina no arquivo de ambiente do serviço da API:

```env
Discord__ClientId=ID_DO_APLICATIVO
Discord__ClientSecret=SEGREDO_OAUTH
Discord__RedirectUri=https://localhost:4200/profile
```

Inicie o Angular com `npm start -- --ssl` na pasta `web` e abra o endereço HTTPS antes de conectar o Discord. O certificado local pode pedir confirmação no navegador. Reinicie a API após salvar. As credenciais OAuth ficam no servidor. Preserve o diretório das chaves de Data Protection entre reinícios e deploys para a API continuar lendo os webhooks já gravados.

## Bora jogar?

Nos detalhes de qualquer jogo do backlog, o usuário pode propor uma sessão com data, horário e uma mensagem opcional de até 300 caracteres. O Angular mostra uma prévia antes da confirmação. A API valida o horário futuro e a propriedade do jogo e publica no canal configurado. O Discord exibe o horário no fuso de quem lê o convite.
