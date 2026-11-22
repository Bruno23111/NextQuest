# 009 Fila e diário

No backlog, cada conta pode ordenar até cinco jogos da própria coleção. Ao remover um jogo da fila, a entrada continua no backlog. Jogos excluídos do backlog desaparecem da fila.

Cada jogo tem um diário editável com três campos opcionais: onde parei, próximo objetivo e notas. A fila e o diário são privados e persistidos no servidor.

## Retomar e começar o próximo

- O destaque de um jogo em andamento mostra onde o jogador parou e o próximo objetivo, quando preenchidos, e leva ao editor do diário.
- Ao salvar a mudança de status para concluído, a tela oferece começar o primeiro outro jogo da fila. A confirmação muda seu status para Jogando e abre os detalhes. A ordem da fila é preservada.
