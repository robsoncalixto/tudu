# Fase 1 — Inventário de interações e linha de base

Estado **antes** das mudanças (commit `165a16b`). Capturas em
[`screens/antes/`](screens/antes/). Contagens brutas em
[`medicoes/antes.json`](medicoes/antes.json).

"Só com teclado?" responde se o fluxo podia ser concluído sem mouse em tempo
razoável. Atrito vai de 1 (fluido) a 5 (trava o uso).

## Inventário

| # | Tela | Elemento | Ação do usuário | Cliques | Teclas | Só com teclado? | Feedback | Problema de a11y | Atrito |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Board | Campo "Write a task…" | Criar tarefa só com título | 1 | título + Enter | Sim, após Tab até o campo | Linha aparece após o POST; campo fica desabilitado durante o envio | — | 2 |
| 2 | Board | Select "Priority" | Definir prioridade da nova tarefa | 2 | — | Sim, com vários Tabs | Prévia abaixo do formulário | — | 3 |
| 3 | Board | Data nativa "Due date" | Definir prazo da nova tarefa | 2 | 8 dígitos | Sim | Prévia | Não aceita "amanhã" nem "sex" | 4 |
| 4 | Board | Campo "Tags" e botão "+" | Adicionar etiqueta | 2 | nome | Sim | Chip na prévia | `datalist` sem anúncio de quantas sugestões | 3 |
| 5 | Board | Formulário inteiro | Ocupa três controles fixos sob o campo | — | — | — | — | Ruído permanente; no celular some atrás de um botão de engrenagem | 3 |
| 6 | Board | "Quick-add shortcuts" | Descobrir a sintaxe | 1 | — | Sim | Texto expandido | A sintaxe existe, mas fica escondida e só aceita `!high` em inglês | 4 |
| 7 | Board | "Create with AI" | Enviar o texto para a IA | 1 | ou Ctrl/⌘+Enter | Sim | "N tasks added" | — | 2 |
| 8 | Board | Mensagem de status | Ler resultado de uma ação | — | — | — | Parágrafo entre o formulário e a lista | Empurra a lista 30px para baixo a cada mensagem | 3 |
| 9 | Board | Busca "Search this list" | Filtrar a lista | 1 | texto | Sim, com Tab | Filtro instantâneo; Esc limpa | `aria-label` em `<label>` (proibido) | 2 |
| 10 | Board | Select de ordenação | Ordenar abertas | 2 | — | Sim | Lista reordena; escolha lembrada | — | 1 |
| 11 | Lista | Checkbox da linha | Concluir tarefa | 1 | Espaço com foco no checkbox | Sim | A linha some para "Done" (fechado). **Nenhuma mensagem, nenhum desfazer** | — | 4 |
| 12 | Lista | "Done" → checkbox | Desfazer uma conclusão | 2 | — | Sim | Linha volta | Exige abrir a seção e achar a tarefa | 4 |
| 13 | Lista | Título da linha | Renomear inline | 1 | texto + Enter | Sim | Título troca | A sintaxe rápida não vale aqui | 2 |
| 14 | Lista | Data da linha | Mudar prazo | 2 | ou 8 dígitos | **Na prática, não**: 130 Tabs até a data da 7ª linha | Rótulo troca | Sem atalhos de data | 4 |
| 15 | Lista | Select de prioridade da linha | Mudar prioridade | 2 | — | Sim | Valor troca | — | 2 |
| 16 | Lista | Sol, subtarefa, "…", painel | Ações da linha | 1 | — | Sim | — | Três ícones sempre visíveis por linha; só o painel aparecia no hover | 2 |
| 17 | Lista | Navegar entre tarefas | Ir de uma linha a outra | — | cerca de 15 Tabs por linha | Só com Tab por todos os controles | Foco no controle | Nenhuma tecla move de linha em linha | 5 |
| 18 | Painel | Título, notas, etiquetas | Editar e salvar | 2 a 3 | texto | Sim | Botões "Save" e "Cancel" por campo | Nome acessível do botão de etiquetas não contém o texto visível | 3 |
| 19 | Painel | "Delete task" | Excluir | 2 | — | Sim | Diálogo modal de confirmação | — | 3 |
| 20 | Sidebar | Views e projetos | Trocar de view | 1 | — | Sim, com Tab | Título e lista trocam | Nome acessível não contém a contagem visível | 2 |
| 21 | Sidebar | "+" de Projects | Criar projeto | 2 | nome + Enter | Sim | Diálogo modal | — | 3 |
| 22 | Global | — | Abrir o campo de nova tarefa de qualquer tela | 1 a 2 | — | Não havia atalho | — | — | 4 |
| 23 | Global | — | Ver os atalhos | — | — | Não existia | — | — | 3 |
| 24 | Assistant | Campo de nota | Enviar a nota | 1 | — | Tab até o botão | Propostas aparecem; o foco não voltava ao campo | — | 3 |
| 25 | Work log | Dia, agrupamento, copiar | Ver e copiar o dia | 1 a 2 | — | Sim | Mensagem de status | — | 1 |
| 26 | Settings | Formulário | Salvar preferências | 1 a 3 | — | Sim | "Settings saved." | — | 1 |
| 27 | Board | Carregamento | Abrir o app | — | — | — | "Loading…" e depois campo e lista surgem de uma vez | Salto de layout ao carregar | 2 |
| 28 | Board | Lista vazia | Começar | 1 | — | Sim | Botão "Add a task" | Sem dica de teclado | 2 |

## Cenários medidos

Cada cenário foi executado de verdade com Playwright na interface antiga, do jeito
que a própria tela sugere. Cliques e teclas são contados pelo script
(`medicoes/antes.json`). O tempo é uma estimativa pelo modelo KLM:
`0,28 s × teclas + 1,3 s × cliques + 0,4 s × trocas entre teclado e mouse`.

| Cenário | Caminho | Cliques | Teclas | Trocas | Tempo estimado | Observação |
| --- | --- | --- | --- | --- | --- | --- |
| C1 — "Revisar proposta", tag `trabalho`, amanhã 14h, prioridade alta | Formulário | **8** | 24 | 4 | 18,7 s | A hora não pode ser registrada |
| C1 | Sintaxe escondida (`#trabalho !high amanhã`) | 1 | 40 | 1 | 12,9 s | Exige saber `!high` em inglês; `!alta`, `@amanha` e `14h` viram texto do título |
| C2 — 5 tarefas seguidas em Today | Clique em Today, clique no campo, digitar | 2 | 49 | 1 | 16,7 s | O foco já ficava no campo |
| C3 — mudar o prazo para sexta | Mouse: data nativa | 2 | 0 | 0 | 2,6 s | — |
| C3 | Teclado | 0 | **138** | 0 | 38,6 s | 130 Tabs até a data da linha, mais 8 dígitos |
| C4 — concluir e desfazer | Checkbox, abrir "Done", checkbox | 3 | 0 | 0 | 3,9 s | Sem mensagem e sem desfazer |
| C5 — achar pelo título e editar | Busca, clique no título, editar | 2 | 10 | 3 | 6,6 s | — |

A frase do critério de aceite, digitada na interface antiga
(`Revisar proposta #trabalho @amanha 14h !alta`), criava a tarefa
**"Revisar proposta @amanha 14h !alta"**, sem prazo e com prioridade média.

## Capturas

`01-all-tasks-desktop`, `02-composer-form-filled-desktop`,
`03-composer-shortcuts-help-desktop`, `04-today-desktop`, `05-task-panel-desktop`,
`06-delete-confirm-desktop`, `07-work-log-desktop`, `08-assistant-desktop`,
`09-settings-desktop`, `10-all-tasks-phone`, `11-composer-details-phone` e
`12-all-tasks-dark-pt` (esta última saiu no tema claro: o tema do app vem das
preferências salvas, não do navegador).
