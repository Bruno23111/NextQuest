# Plano 005

Usar o [OpenID 2.0 da Steam](https://partner.steamgames.com/doc/features/auth#website) para autenticar o SteamID. A API valida o retorno no endpoint HTTPS da Valve. O PostgreSQL guarda a tentativa por cinco minutos, valida a associação ao código de uso único e impõe unicidade do SteamID. O login emite a sessão bearer já usada pela autenticação por e-mail.

A API registra o SteamID verificado. Contas criadas pela Steam não recebem endereço de e-mail fictício. A vinculação preserva o identificador local e os jogos existentes. Uma operação explícita diferencia a vinculação autenticada da criação de conta ou entrada via Steam.

O app inicia o fluxo com um desafio S256 e guarda o verificador localmente. A API redireciona o navegador para uma URL configurada com o código e o estado. O app troca o código e o verificador em um POST. Veja o [guia de integração Flutter](flutter.md).
