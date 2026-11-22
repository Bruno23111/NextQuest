# 008 Aplicação Web (Angular)

Construir a aplicação web oficial do **NextQuest** em **Angular** (em `web/`), cobrindo todos os fluxos já especificados na API (`openapi-v1.json`: Conta, Login Steam, Backlog, Catálogo RAWG, Biblioteca/Conquistas Steam e Perfil) e seguindo o layout visual do template [Steam Redesign (Dribbble #26698011)](https://dribbble.com/shots/26698011-Steam-redesign).

## Módulos incluídos

1. **Conta & Login Steam (Specs 001 e 005)**
   - Cadastro, confirmação de e-mail, login com e-mail/senha, renovação de sessão (`refresh`) e recuperação/redefinição de senha.
   - Login e vínculo de conta via Steam (`/api/v1/auth/steam/start`, `/link/start`, `/redeem`).
2. **Biblioteca / Backlog Pessoal (Spec 002)**
   - Listagem paginada com filtros por status (`planned`, `playing`, `completed`, `dropped`) e busca por texto.
   - Criação manual, visualização de detalhes, edição de título, plataforma e status, e exclusão.
3. **Catálogo RAWG (Spec 003)**
   - Busca de jogos no catálogo RAWG e importação direta para o backlog com tratamento de duplicidade (`409 Conflict`).
4. **Biblioteca & Conquistas Steam (Spec 006)**
   - Exibição dos jogos vinculados à Steam, tempo jogado e progresso de conquistas.
5. **Perfil do Usuário (Spec 007)**
   - Visualização e edição com prévia ao vivo de nome de exibição (até 60 caracteres), descrição (até 300 caracteres), avatar e capa (arquivos PNG, JPEG ou WebP de até 8 MB cada).

## Referência visual e identidade

- Layout alinhado ao template [Steam Redesign (Dribbble #26698011)](https://dribbble.com/shots/26698011-Steam-redesign), composto por:
  - Rail lateral estreito (`76px`, expansível para `228px`) de ícones com tooltips flutuantes em pill e divisores sutis;
  - Cabeçalho minimalista com saudação personalizada, 4 abas pill centrais (`Meus jogos`, `Jogando`, `Planejados`, `Zerados`), busca rápida expansível, atalho circular `+` e avatar com indicador online;
  - **Hero Banner Full-Bleed** com arte em tela cheia, status/plataforma em pill fosca e ações flutuantes no canto inferior direito (`settings`, `add` e CTA pill `Continuar jogando` / `Abrir jogo`);
  - **Grade Bento de 3 Colunas**: card *Conquistas* (progresso Steam ou fallback real do backlog), card *Na sua fila* (mini lista com thumbnails circulares) e card *Atividade* (heatmap de 28 dias `Seg–Dom` com padrão hachurado para dias vazios e níveis 1–3);
  - Seção completa da biblioteca com alternância entre grade de pôsteres `3:4` e lista compacta, skeleton loaders, paginação e modal centralizado para adição de jogos;
  - Página de detalhes cinematográfica e biblioteca Steam com capas HD (`library_600x900` com fallback para `header.jpg` e monograma);
- Identidade visual preservada do aplicativo Flutter (`AppColors`: fundo `#101113`, superfícies `#17181A`/`#1D1F21`/`#25282B`, acento marca `#B5E34C`, teal/ciano `#0B697A`/`#8BDAEB`, borda `#343739`, status `#CBC0FF`/`#8BDAEB`/`#81D5AB`/`#F4A4AF`), ícones **Material Symbols Rounded** e marca `nextquest.png`.

## Aceite

- A aplicação web em `web/` consome exclusivamente os endpoints documentados em `specs/openapi-v1.json` sem alterar o contrato da API.
- Todos os fluxos autenticados preservam isolamento por conta, enviam `Authorization: Bearer` e tratam expiração com `refresh` automático.
- Erros da API (`ProblemDetails` / `HttpValidationProblemDetails`) são exibidos de forma clara ao usuário em português.
- O layout segue fielmente o template Dribbble #26698011 em desktop e permanece responsivo em telas menores.
- O build de produção (`ng build`) e os testes automatizados do frontend executam sem erros.
