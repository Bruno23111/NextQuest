# Plano 001

A API usa ASP.NET Core Identity com persistência EF Core, tokens bearer opacos, senhas com pelo menos oito caracteres e SMTP. O token de acesso dura 15 minutos e o token de renovação dura sete dias. O servidor protege os tokens com chaves persistentes em homologação.

O app envia os corpos definidos no [OpenAPI](../openapi-v1.json). Usa armazenamento seguro para a sessão, executa uma renovação por vez ao receber 401 em rotas protegidas e tenta a requisição original uma vez após renovar. Ao renovar com 401, volta ao login. Ao sair, limpa tokens e o estado de biblioteca da sessão local.
