# Relatório — UX e fluidez de interação no TUDU

Branch `feature/ux-fluidez-inputs`, a partir de `165a16b`. Capturas em
[`screens/antes/`](screens/antes/) e [`screens/depois/`](screens/depois/); contagens
brutas em [`medicoes/`](medicoes/).

## Resumo

O formulário de criação virou **um campo único** que entende a tarefa inteira:
`Revisar proposta #trabalho @amanha 14h !alta` e Enter, sem nenhum clique. Chips
sob o campo mostram os mesmos valores em tempo real e permitem ajustá-los com o
mouse. A lista ganhou teclado (`J`/`K`, Espaço, Enter, `E`, Delete), toda ação
rápida oferece **Desfazer** em vez de confirmação, e todo atalho vem de um
registro único que também gera a folha `?`. Uma revisão independente de
usabilidade e acessibilidade reprovou a primeira entrega por três problemas
graves; eles e quase todos os menores foram corrigidos, e a segunda rodada da
revisão **aprovou** a tela (ver "Revisão independente"). Nenhum contrato de API,
schema de banco ou modelo de domínio foi alterado.

## Antes e depois

Os cinco cenários foram executados de verdade com Playwright nas duas versões.
Tempo estimado pelo modelo KLM
(`0,28 s × teclas + 1,3 s × cliques + 0,4 s × trocas entre teclado e mouse`).

| Cenário | Antes | Depois | O que mudou |
| --- | --- | --- | --- |
| **C1** — "Revisar proposta", tag `trabalho`, amanhã 14h, alta | 8 cliques, 24 teclas, ~18,7 s. A hora não podia ser registrada | **0 cliques**, 46 teclas, ~12,9 s | Tudo digitado no campo; a hora fica como período do dia (tarde) |
| C1, só com mouse para os campos | 8 cliques, 24 teclas, sem a hora | 9 cliques, 26 teclas, **com** o período da tarde | Chips com menus; o chip de prazo também escolhe o período do dia |
| **C2** — 5 tarefas seguidas em Today | 2 cliques, 49 teclas, ~16,7 s | **0 cliques**, 52 teclas, ~14,6 s | `G` `T`, `N` e digitar; o campo nunca fica desabilitado e cada tarefa é confirmada pelo nome |
| **C3** — prazo para sexta, pelo teclado | 138 teclas (130 Tabs), ~38,6 s | **12 teclas**, ~3,4 s | `/`, 3 letras, `↓`, Enter, ` @sex`, Enter; o aviso diz o novo prazo e oferece desfazer |
| C3, pelo mouse | 2 cliques, ~2,6 s | 1 clique e 6 teclas, ~3,4 s | Clique no título e ` @sex`; a data nativa da linha continua disponível, agora com desfazer |
| **C4** — concluir e desfazer | 3 cliques, ~3,9 s, sem nenhuma mensagem | **3 teclas** (`J`, Espaço, `Z`), ~0,8 s; ou 2 cliques | Aviso com o nome da tarefa e Desfazer, em vários níveis |
| **C5** — achar pelo título e editar | 2 cliques, 10 teclas, ~6,6 s | **0 cliques**, 12 teclas, ~3,4 s | `/`, busca, `↓`, Enter, editar, Enter |

A frase do critério de aceite, que antes criava a tarefa "Revisar proposta @amanha
14h !alta" sem prazo, agora cria "Revisar proposta" com a etiqueta, o prazo de
amanhã, o período da tarde e a prioridade alta.

## Critérios de aceite

| Critério | Situação | Onde está comprovado |
| --- | --- | --- |
| Frase completa e Enter criam a tarefa certa, sem clique | Atendido, com a ressalva da hora (abaixo) | `e2e/command-field.spec.ts` |
| Campo focado e vazio após o Enter; 5 tarefas seguidas | Atendido | `e2e/command-field.spec.ts` |
| Em Today, a tarefa nasce com o dia de hoje e o chip mostra "Today" com × | Atendido | `e2e/command-field.spec.ts`, `e2e/composer-chips.spec.ts` |
| Chips refletem os tokens; escolher e remover mantêm texto e estado coerentes | Atendido | `e2e/composer-chips.spec.ts` |
| `C#`, `nome@email.com` e `bla#bla` não viram tokens; `\#` vira `#` | Atendido | `syntax.test.ts`, `e2e/command-field.spec.ts` |
| Autocomplete de `#`, `+` e `@` com ↑ ↓ Enter Tab Esc, padrão combobox | Atendido | `e2e/command-field.spec.ts` |
| Atalho global foca a barra em qualquer tela e não dispara em campos | Atendido | `e2e/shortcut-sheet.spec.ts`, `e2e/task-skeleton.spec.ts` |
| Ctrl/⌘+Enter cria com IA a partir do mesmo texto | Atendido (já existia; mantido) | `e2e/composer.spec.ts` |
| Concluir e excluir oferecem desfazer; nenhum `alert` ou `confirm` | Atendido | `e2e/board-notice.spec.ts`, `e2e/task-row.spec.ts` |
| `?` mostra a folha gerada do registro central | Atendido | `e2e/shortcut-sheet.spec.ts`, `shortcuts/selectors.test.ts` |
| Caminho por mouse continua funcionando | Atendido | suíte e2e inteira |
| Testes existentes passam; parser ≥ 90%; type-check e build verdes | Atendido: 682 testes unitários e 387 e2e; parser com 100% das linhas e 99% dos ramos | `npm test`, `npm run test:e2e`, `npm run typecheck`, `npm run build` |
| Nenhuma violação nova serious ou critical | Atendido, e quatro antigas foram corrigidas | `e2e/accessibility.spec.ts` |
| C1 cai para 0 cliques | Atendido (era 8) | `medicoes/` |
| Relatório completo | Este arquivo | — |

**Ressalva sobre "amanhã às 14h".** O prazo guarda só o dia. A hora digitada é
reconhecida, sai do título e é salva como o período do dia que já existe no
modelo (`partOfDay`: manhã até 11h59, tarde até 17h59, noite depois). O chip
mostra "Due date: Tomorrow · Afternoon" e explica que a hora exata não é
guardada. Guardar a hora depende de backend (ver adiante).

## Mudanças por tela

Os hashes são os commits do branch.

**Campo de nova tarefa** (`2a29542`, `905b8c8`, `4c7f5c7`; lógica em `e0d8937`, `e3c9fa7`, `81a02ee`, `3d22a0f`, `d5d7437`)

- Um campo com os tokens reconhecidos destacados e o que não foi entendido
  sublinhado, sem trocar o `textarea` por `contenteditable`: IME, colar e o
  desfazer do navegador continuam nativos.
- O sublinhado e o aviso só aparecem depois que o cursor sai da palavra ou a
  digitação pausa, e o aviso usa uma linha reservada sob o campo: a lista não
  se move.
- Autocomplete para `#`, `+`, `@` e `!` em um listbox ligado ao campo. Enter
  completa a sugestão; se o token digitado já está completo, Enter salva.
- Enter mostra a tarefa na lista na hora, na posição em que ela ficará, e deixa
  o campo livre. Um aviso diz o nome da tarefa criada e leva até ela (**Show**).
- Se o servidor recusar, o texto volta ao campo; se a pessoa já estiver
  escrevendo a próxima, a que falhou espera no aviso, com **Retry**.
- O campo cresce até oito linhas e rola a partir daí. Várias linhas mostram o
  que cada uma vira, com "Add N tasks" e "Make it one task"; marcadores de
  lista colada (`-`, `1.`, `[ ]`) ficam fora dos títulos.
- O que impede salvar é dito em uma única mensagem: título ausente ao tentar
  salvar; título longo demais ou mais de 50 linhas, enquanto se digita.
- Esc fecha as sugestões, depois limpa (o desfazer do navegador traz o texto de
  volta), depois devolve o teclado à lista. `N` pressionado durante o
  carregamento é lembrado, e o que for digitado em seguida cai no campo.

**Chips** (`2a29542`, `abeb834`, `905b8c8`)

- Projeto, dia planejado, prazo, prioridade, estimativa, repetição e
  etiquetas. Vazios, mostram ícone e rótulo em qualquer largura; preenchidos, o
  valor e um ×. Os dois chips de dia mostram "rótulo: valor", porque ambos
  podem conter o mesmo dia.
- O chip de prazo também escolhe o período do dia. Uma tarefa que repete, ou
  que tem período do dia, parte do próprio prazo ou de hoje.
- Com várias linhas e com "Create with AI", os chips são padrões de todas as
  tarefas (`07f2472`).
- O que foi entendido é anunciado para leitores de tela quando a digitação
  pausa.

**Lista** (`e1494bd`, `905b8c8`, `ab28c62`, `4cdd7a6`)

- `J`/`K` e setas entre linhas; Espaço ou `D` conclui; Enter edita; `E` ou duplo
  clique abre os detalhes; Delete exclui. O menu de ações da linha também exclui.
- Aviso flutuante com o nome da tarefa e Desfazer para concluir, reabrir,
  excluir e mudar o prazo. `Z` desfaz uma ação após a outra, da mais recente
  para a mais antiga. A exclusão, e a conclusão de uma tarefa que repete, só
  chegam ao servidor quando o aviso sai (6 s, pausa com o ponteiro ou o foco em
  cima), ao trocar de tela e ao fechar ou recarregar a página; em telas de
  toque, também ao ocultá-la. Desfazer não deixa resto. Trocar de lista mantém
  o aviso e a chance de desfazer.
- Uma alteração que não pôde ser salva oferece **Retry** no próprio aviso.
- Título editado no lugar, com o mesmo campo da criação. Palavras que já estavam
  no título salvo nunca são reinterpretadas nem destacadas como tokens.
- Esc em uma tarefa limpa a busca sem tirar o foco dela, depois fecha os
  detalhes. Quando a lista esvazia, o foco fica no quadro, onde `Z` funciona.

**Atalhos** (`acb2c88`, `905b8c8`)

- `shortcuts/schema.ts` é a fonte única; quem trata teclas consulta o registro e
  a folha `?` o renderiza, junto com a referência da sintaxe.
- `N` ou Shift+A, `/`, `G` e letra, `Z` ou Ctrl/⌘+Z, `?`.
- Nunca disparam durante a digitação e podem ser desligados por dispositivo.

**Detalhes da tarefa** (`43abc91`, `66c8564`, `ab28c62`): notas salvas 0,8 s após
a última tecla, ao fechar ou trocar de tarefa e ao fechar ou ocultar a página,
com "Saved." ao lado do rótulo; Esc nas
notas fecha o painel e mantém o que foi escrito. Título e etiquetas são salvos
no Enter ou ao sair do campo, e Esc descarta essa edição. Falha mantém o texto
com "Retry".

**Assistant** (`7272267`, `0a7aa38`): Enter envia, Shift+Enter quebra a linha, ↑
no campo vazio recupera a última nota, e o foco volta ao campo após a resposta.

**Sidebar** (`a8fe8ba`): o "+" de Projects abre um campo no próprio lugar.

**Carregamento e vazio** (`a8fe8ba`, `905b8c8`): placeholders do tamanho exato do
campo, dos chips e da lista; a lista vazia mostra as teclas que a preenchem.

**Acessibilidade** (`43f50f8`): auditoria com axe do board, de cada camada aberta
e das outras telas, em claro e escuro, nos dois idiomas e no celular.

**Infraestrutura** (`b529319`, `ea7b918`, `a709ca4`, `d016948`): portas dos testes
e2e configuráveis para rodar em paralelo com outros worktrees; correção de uma
corrida de foco ao fechar o painel; estado do quadro, do campo e da barra lateral
movido para hooks.

## Revisão independente

A primeira entrega foi submetida a uma revisão independente de usabilidade e
acessibilidade (49 sessões de navegador, 206 capturas, 40 varreduras com axe).

**Primeira rodada: não aprovado.** Todos os critérios de aceite passaram e não
houve bloqueante, mas três problemas graves e dezesseis menores foram apontados.

| Apontamento | Gravidade | O que foi feito |
| --- | --- | --- |
| Esc nas notas descartava texto já salvo | Grave | Esc nunca desfaz notas: fecha o painel e mantém o texto. "Saved." passou para junto do rótulo (`66c8564`) |
| Com mais de 8 linhas o campo invadia os chips e a lista, e o botão "Add N tasks" não recebia o clique | Grave | O campo rola a partir de 8 linhas; a prévia rola a partir de 6; o limite de 50 linhas é avisado na hora (`905b8c8`) |
| A tarefa criada não ficava visível nem era anunciada; em Today piscava no topo | Grave | Linha na posição final desde o início, mesma linha após salvar, aviso com o nome e botão que leva até ela, destaque onde pousou (`905b8c8`) |
| Avisos falsos e lista pulando ao digitar data ou projeto | Menor | Aviso só depois de sair da palavra, em linha reservada |
| Nome de projeto longo quebrava a lista de sugestões | Menor | Uma linha com reticências, altura máxima e rolagem |
| Sugestões não voltavam depois de um Esc | Menor | A dispensa vale só para a palavra em que foi feita |
| Mensagens de validação duplicadas e vagas | Menor | Uma mensagem, específica, no próprio campo |
| Lacunas para leitor de tela | Menor | Desfazer é anunciado; contagem de sugestões e resumo do que foi entendido só quando a digitação pausa; tecla no botão Desfazer; campos de data auxiliares fora da árvore |
| Foco caindo no `body` | Menor | Dispensar, tentar de novo e a captura com IA mantêm o foco em lugar útil |
| Desfazer incompleto | Menor | Vários níveis; tarefa que repete não deixa a próxima para trás; foco no quadro quando a lista esvazia |
| Dois chips podiam mostrar "Today ×"; chips sem rótulo no celular | Menor | "Rótulo: valor" nos dois chips de dia; rótulos em qualquer largura |
| Período do dia só pelo teclado; excluir só no fim do painel | Menor | Período do dia no chip de prazo; "Delete task" no menu da linha |
| Surpresas do parser | Menor | "depois de amanhã" e `~45min` entendidos; palavras do título em edição não são destacadas. Ver pendências para o que ficou |
| Setas no campo de data da linha mudavam o prazo em silêncio | Menor | Aviso com o novo prazo e Desfazer, um só para a sequência |
| Marcadores de lista colada iam para os títulos | Menor | Removidos quando há várias linhas |
| Falhas: rascunhos misturados e edição perdida | Menor | A tarefa que falhou espera no aviso com Retry; alteração que falhou pode ser reenviada |
| Esc com busca ativa | Menor | Na tarefa, limpa a busca e mantém o foco; na busca, limpa e depois vai para a lista |
| Captura com IA voltava para All tasks | Menor | A tela continua onde estava |
| `N` perdido durante o carregamento | Menor | A tecla é lembrada e o texto digitado em seguida cai no campo |

**Segunda rodada: aprovado.** Sobre o build do commit `b67ae83` (36 sessões de
navegador, 134 capturas, 64 varreduras com axe): os três graves foram
confirmados como corrigidos, C1 a C5 passaram por teclado e por mouse, e não
restou bloqueante nem grave. Ficaram onze apontamentos menores, tratados em
seguida ou registrados como pendência:

| Apontamento da segunda rodada | O que foi feito |
| --- | --- |
| Em celulares pequenos a primeira tela não mostra tarefa, pelo espaço dos chips com rótulo | Mantido: é o custo dos rótulos, pedido na primeira rodada. Ver pendências |
| Texto do aviso cortado em uma linha | O aviso quebra em até três linhas, com os botões embaixo em tela estreita (`ab28c62`) |
| A próxima ocorrência de uma tarefa que repete aparece só quando o aviso sai | Mantido: é o que permite desfazer sem deixar resto. Ver pendências |
| Alterações retidas nem sempre eram enviadas ao sair da página | O pedido sai no mesmo instante em que é feito; em telas de toque, ocultar a página também encerra a espera (`ab28c62`, `4cdd7a6`) |
| Data ou projeto errado no fim da linha nunca era apontado | Apontado quando a digitação pausa (`4c7f5c7`) |
| "Retry" deixava o foco no `body` | O foco volta para onde estava quando o aviso surgiu (`ab28c62`) |
| Esc com busca ativa deixava a tarefa em foco fora da tela | A tarefa é trazida para o centro da tela (`ab28c62`) |
| Desfazer não funcionava a partir do campo de data da linha | Ctrl/⌘+Z funciona ali (`ab28c62`) |
| Duas opções de período do dia ficavam abaixo da dobra do menu | O menu mostra todas as opções (`ab28c62`) |
| `@depois de amanhã` virava amanhã | A expressão é lida inteira, com ou sem `@` (`d5d7437`) |
| A janela de desfazer terminava ao trocar de lista ou criar uma tarefa | Trocar de lista mantém o aviso (`ab28c62`); criar uma tarefa ainda o substitui |

**Confirmação após esses ajustes: aprovado, o veredito se mantém.** Sobre o build
do commit `1a485ed` (15 sessões focadas, 47 capturas): C1 a C5 passaram de novo
por teclado e por mouse e nada do que estava aprovado quebrou. No Chrome,
nenhuma alteração retida se perdeu em 72 tentativas de recarregar, navegar ou
fechar a aba com até cinco retidas. Duas regressões pequenas, causadas pelos
próprios ajustes, foram apontadas e corrigidas em seguida (`4cdd7a6`): avisos
curtos passaram a quebrar os botões em duas linhas, e uma pausa em um `+projeto`
ainda incompleto mostrava um aviso falso ao lado da sugestão. Encerrar a janela
de desfazer ao ocultar a página passou a valer só em telas de toque, para que
uma olhada em outra aba não torne uma exclusão definitiva.

**Checagem dessas duas correções: aprovado, o veredito se mantém.** Sobre o build
do commit `defbfd5`, que é o estado final do código: C1 a C5 passaram pelo
teclado, nada piorou e as duas regressões estão corrigidas no desktop. Uma delas
ainda aparece em celulares para algumas faixas de tamanho de texto (ver
pendências); é cosmética.

A revisão não rodou os testes, a cobertura, o type-check nem o build, e não
verificou fala real de leitor de tela, seletores nativos de data, IME, Safari,
Firefox nem um provedor de IA de verdade.

## Decisões e alternativas descartadas

| Decisão | Alternativa descartada | Motivo |
| --- | --- | --- |
| Manter a sintaxe que já existia e somar a do documento | Trocar `@projeto` por `+projeto` e exigir `@` nas datas | O documento dá prioridade ao que existe; nada que funcionava deixou de funcionar. `@nome` tenta projeto e depois data |
| Hora vira período do dia | Deixar "14h" no título, ou descartar com aviso | É o campo do modelo que mais se aproxima, o título fica limpo e nada some em silêncio |
| Nomes curtos de dia (`sex`, `ter`, `sat`) só com `@` | Aceitar como palavra solta | "ter" é verbo, "sex" e "sun" são palavras: virariam datas em títulos comuns |
| Chip guarda o valor no estado e remove o token do texto | Chip escrever o token no texto | Com várias linhas os chips são padrões de todas; e a captura com IA recebe os padrões separados do texto |
| `textarea` com camada de destaque por baixo | `contenteditable` | Preserva IME, colar e desfazer nativos |
| `role="combobox"` no `textarea` | `textbox` com região viva | É o padrão que o documento pede e o que leitores de tela anunciam melhor. O axe aponta "aria-allowed-role" como **minor** (o HTML não prevê esse papel em `textarea`); o campo precisa de várias linhas |
| Exclusão e conclusão de tarefa que repete adiadas até o aviso sair | Enviar e depois compensar ao desfazer | Recriar trocaria o id e a data de criação; e reabrir uma tarefa que repete deixaria a próxima ocorrência criada |
| Tarefa que falhou ao salvar espera no aviso | Juntar o texto dela ao que já está no campo | Os chips de uma passariam a valer para a outra |
| Só tokens na edição de um título alteram os campos e mantêm o título | Não salvar nada | Não salvar em silêncio foi apontado como falha; título vazio não é válido |
| Rótulos dos chips sempre visíveis, com quebra de linha | Só ícones no celular | Ícones sozinhos não dizem o campo; o documento pede chips com rótulo e quebra no celular |
| Atalhos de uma tecla desligáveis | Sempre ligados | WCAG 2.1.4; também responde ao motivo provável de terem sido removidos antes |
| Data e prioridade da linha continuam nativas | Popover próprio | `design.md` pede controles nativos; o teclado ganhou `@sex` na edição do título |
| Mensagens de commit no padrão do repositório | Conventional Commits | `AGENTS.md` define mensagens curtas no imperativo |

## Dependências adicionadas

| Pacote | Tipo | Por quê |
| --- | --- | --- |
| `@axe-core/playwright` | dev | Motor de auditoria de acessibilidade usado no e2e. Não é algo que se reescreve à mão; é mantido pela Deque e não entra no build |

Nenhuma dependência de produção. As datas em linguagem natural ficaram em
`quick-add/due-words.ts` (cerca de 110 linhas, 100% das linhas cobertas): PT e EN
com um vocabulário fechado não justificavam uma biblioteca como `chrono-node`.

## Oportunidades que dependem de backend

- **Hora no prazo.** Um campo de hora (ou `due` com data e hora) permitiria
  guardar "14h" de fato, ordenar por horário e lembrar.
- **Desfazer no servidor.** Uma exclusão reversível (lixeira) e uma forma de
  desfazer a criação da próxima ocorrência tornariam o desfazer independente de
  a aba continuar aberta.
- **Estimativa e repetição na captura com IA.** Hoje esses dois chips são
  aplicados em uma segunda escrita, porque o contrato de captura não os aceita.
- **Criar projeto pelo token.** `+novo-projeto` poderia criar o projeto na mesma
  escrita da tarefa.
- **Preferências de atalho por conta.** Hoje a chave liga/desliga fica no
  dispositivo.

## Pendências e riscos conhecidos

- **Branches paralelos.** `fix/restore-composer-details` e
  `fix/preserve-board-sort` tocam `Composer.tsx` e `use-board-navigation.ts`. O
  primeiro precisa de rebase: os "detalhes" que ele guarda agora são as escolhas
  dos chips (`ComposerChoice`).
- **Ordenação por view** ficou como estava (lista e Today), pelo conflito acima.
- **Palavras soltas como data** continuam valendo ("Black Friday campaign" tem
  prazo sexta), como antes: é a sintaxe que já existia e um teste antigo a fixa.
  O destaque no campo e o chip mostram a leitura; `\Friday` mantém o texto. O
  mesmo vale para `#482` virar etiqueta e para `!urgent` continuar texto.
- **Só Chromium nos testes.** A camada de destaque depende de o `textarea` e o
  espelho terem a mesma métrica de texto; não foi verificada em Safari no iOS.
- **Uma linha tem 11 paradas de Tab**, como antes. `J`/`K` contornam; reduzir
  exigiria reestruturar a linha.
- **Celulares pequenos.** Com os chips rotulados, em telas de 320 a 375 px de
  largura a primeira tarefa fica abaixo da dobra. A alternativa (só ícones)
  esconde o que cada chip faz.
- **Tarefa que repete.** A próxima ocorrência aparece quando o aviso sai, cerca
  de seis segundos depois de concluir. Com duas alterações retidas na mesma
  tarefa, a segunda espera a resposta da primeira e pode se perder se a aba for
  fechada de forma abrupta. Notas digitadas no instante de sair para outro site
  podem não ser salvas: o pedido é feito, mas o navegador pode descartá-lo.
- **Criar uma tarefa encerra a janela de desfazer** da ação anterior, porque o
  aviso da criação toma o lugar do anterior.
- **Um título editado no lugar com mais de 300 caracteres** é recusado com a
  mensagem genérica, e o texto digitado se perde.
- **`N` a partir de outra tela** pode perder o primeiro caractere digitado
  enquanto a tela de tarefas abre.
- **Contadores da barra lateral mostram 0 durante o carregamento.**
- **Aviso de console do Chromium** sobre `beforetoggle` ao abrir um menu de chip
  logo após o carregamento. Sem efeito funcional; a causa não foi isolada.
- **Um aviso com mais de três linhas é cortado** (título muito longo em tela
  estreita); o texto inteiro fica na dica do aviso.
- **No celular, o × do aviso pode ficar sozinho em uma segunda linha** quando o
  texto e o botão de ação cabem na primeira e ele não (cerca de 390 px de
  largura). Agrupar os dois botões resolve; ficou de fora para não alterar o
  código depois da última checagem.
- **Os commits `905b8c8` e `ab28c62` são grandes.** As correções da revisão
  tocam os mesmos arquivos e não foram separadas em commits menores.
- **Estimativa `t25m`.** Segue o documento; uma palavra como `t5m` em um título
  vira estimativa. `\t5m` mantém o texto.
