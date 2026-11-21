# Plano 002

Expor os métodos da biblioteca definidos no [OpenAPI](../openapi-v1.json). Os objetos da API usam UUID, datas UTC e nomes JSON em camelCase. A lista usa páginas de 20 itens iniciadas em 1, informa `hasMore` e desempata a ordenação pelo UUID. Busca por título é parcial e não diferencia maiúsculas. Para editar, o cliente envia apenas os campos alterados em PATCH.

O app usa os status do contrato e suas traduções. Criar tela de lista, formulário manual e detalhes com edição e remoção. Ao editar ou excluir, atualizar a lista e respeitar os filtros ativos.
