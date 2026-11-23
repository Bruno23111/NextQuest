# 013 Promoções de jogos

A página Promoções lista ofertas de jogos de PC fornecidas pelo IsThereAnyDeal para a região Brasil. Cada oferta mostra jogo, loja, preço na moeda retornada, desconto e link original. A pessoa pode navegar pelas páginas e ordenar por desconto ou preço.

A API consulta o provedor com uma chave no servidor. Sem chave, exibe uma mensagem de configuração. Quando o provedor falha, permite tentar novamente.

## Configuração local

Registre o NextQuest no IsThereAnyDeal e adicione `IsThereAnyDeal__ApiKey` ao arquivo de ambiente da API. Reinicie o serviço para carregar a chave. Consulte https://docs.isthereanydeal.com/ para obter acesso.

A busca por título consulta até 20 jogos correspondentes no IsThereAnyDeal e mostra os que têm desconto na região Brasil. A ordenação selecionada se aplica ao resultado. Limpar a busca volta à lista geral.

O filtro Plataforma / loja oferece Todas, Steam, GOG e Nuuvem. A loja selecionada é enviada ao provedor na lista geral e na consulta de preços da busca. A região continua sendo Brasil.

Na lista geral, Jogos populares filtra ofertas de títulos com pelo menos 1.000 avaliações na Steam. Pode ser combinado com loja e ordenação. A busca por título usa outro endpoint do provedor e desativa esse filtro.
