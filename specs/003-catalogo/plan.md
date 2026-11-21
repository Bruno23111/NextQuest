# Plano 003

O [OpenAPI](../openapi-v1.json) define pesquisa e importação por `rawgId` e `platformId`. O servidor consulta o RAWG com a chave privada de configuração, valida a plataforma e persiste uma cópia dos metadados usados na biblioteca. O PostgreSQL impõe unicidade de conta, jogo e plataforma e a API converte conflito em 409.

O app apresenta busca paginada e seleção explícita de plataforma. Capa ausente usa um placeholder. A tela exibe 503 como indisponibilidade temporária. Exibir link para https://rawg.io em cada tela que apresenta dados RAWG.
