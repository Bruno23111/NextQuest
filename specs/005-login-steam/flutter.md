# Integração Flutter com login Steam

Use o [OpenAPI](../openapi-v1.json) e os [exemplos](../examples/steam-auth.json). O servidor local usa `Steam__WebReturnUrl=http://localhost:3000/#/auth/steam/callback` na configuração de desenvolvimento e permite requisições da origem `http://localhost:3000`.

## Entrar e vincular

1. Para cada tentativa, gere 32 bytes aleatórios criptograficamente seguros e codifique em Base64 URL sem preenchimento. Esse texto é o `codeVerifier`. Calcule SHA-256 sobre o texto do verificador e codifique o hash em Base64 URL sem preenchimento para obter `codeChallenge`.
2. Envie o desafio para `POST /api/v1/auth/steam/start` no login, ou para `POST /api/v1/auth/steam/link/start` com a sessão bearer no vínculo. Guarde o `state`, o verificador e a operação em andamento. Abra a `authorizationUrl` retornada.
3. A Steam envia o navegador ao callback da API. Após verificar a resposta com a Valve, a API devolve o navegador à rota Flutter configurada com `state` e `code` ou `error`. Compare o estado recebido com o que foi armazenado. Os erros de retorno são `cancelled` e `invalid_steam_response`.
4. No login, envie `state`, `code` e `codeVerifier` a `POST /api/v1/auth/steam/token`, armazene a sessão retornada e abra a biblioteca. No vínculo, envie os mesmos campos a `POST /api/v1/auth/steam/link` com a sessão da conta que iniciou o fluxo. A resposta de sucesso do vínculo é `204`. Mostre conflito se a API retornar `409`.
5. Apague a tentativa após o resultado e limpe os parâmetros da rota. Uma tentativa expirada exige reiniciar o fluxo.

Como a sessão atual do Flutter Web fica em memória, implemente a autorização em uma janela separada para preservar a conta logada durante o vínculo. Na página de retorno, envie ao opener apenas o código, o estado ou o erro, com a origem do app como destino. O app verifica a origem, a janela e o estado antes de trocar o código. A rota de callback precisa funcionar mesmo com a sessão inicial do app indisponível na janela de retorno. Abra a janela a partir do clique para evitar bloqueio de popup. O ambiente de desenvolvimento deve usar o mesmo hostname configurado em `Steam__WebReturnUrl`.

Steam não fornece o e-mail neste fluxo. Na tela Conta, use uma apresentação neutra para contas criadas pela Steam. Para quem já possui biblioteca por e-mail, ofereça **Vincular Steam** depois do login por e-mail.
