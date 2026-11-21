# 001 Conta e sessão

Uma pessoa cria uma conta por e-mail, confirma o endereço no navegador e entra no app. Ao retornar ao app, a sessão pode ser renovada. A pessoa também pode reenviar a confirmação, solicitar um código de recuperação e definir uma nova senha.

## Aceite

- Uma conta sem confirmação recebe 401 no login.
- A conta confirmada recebe token de acesso e de renovação. O app mantém a sessão e pode sair limpando os dados da conta no aparelho.
- O código de recuperação é enviado para um e-mail confirmado. Ao trocar a senha, os tokens de renovação anteriores deixam de funcionar.
- Requisições de recuperação e reenvio sem conta correspondente recebem a mesma confirmação de recebimento que as demais.
