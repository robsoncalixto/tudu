# Fase 0 — Reconhecimento

Levantamento feito no commit `165a16b` (master), antes de qualquer mudança.

## Stack e comandos

| Item | O que o projeto usa |
| --- | --- |
| Framework | Next.js 16 (App Router, Turbopack) com React 19 e TypeScript 5.9 em modo estrito |
| Validação e contratos | Zod 4, um `schema.ts` por feature |
| Biblioteca de UI | Nenhuma. CSS escrito à mão, com tokens em `src/app/globals.css` descritos em `design.md` |
| Estado | Hooks e um contexto (`TaskWorkspace`). Não há gerenciador de estado |
| Cliente HTTP | `fetch` embrulhado em `src/lib/http.ts`, exposto por feature em `api.ts` |
| Dados | `data/tasks.json` ou PostgreSQL, sempre por `tasks/server/repository.ts` |
| Testes | Vitest 4 (unitários, ao lado do código) e Playwright 1.65 (e2e, um worker, build na porta 3100) |
| Lint | Não existe. Os gates são `npm test`, `npm run test:e2e`, `npm run typecheck` e `npm run build` |

Rodar: `npm run dev` ou `docker compose up --build`, em <http://localhost:3000>.

Linha de base dos gates: 431 testes unitários em 48 arquivos e 281 testes e2e em
30 specs, todos passando. Não havia verificação automática de acessibilidade.

## Estrutura

`src/app` só roteia. Cada capacidade vive em `src/features/<nome>` com `schema.ts`,
`api.ts`, hooks, `selectors.ts`, `components/` e `server/`. Uma feature só pode
importar de outra o `schema.ts` e o `api.ts`. As regras estão em `AGENTS.md`, que
vale como contrato do repositório e prevaleceu sobre o documento de missão quando
os dois divergiram (ver "Divergências").

## Onde a tarefa é criada

`Composer.tsx` → `Board.submit` → `useTasks.add` → `quickAddApi.create` →
`tasksApi.create` → `POST /api/tasks`. O corpo é um rascunho ou uma lista de 1 a
50 rascunhos (`taskDraftSchema`); a resposta é `{ "tasks": [...] }`. A captura
com IA usa `POST /api/ai/capture` com `{ text, today, defaults }`.

## Modelo de dados relevante

`title`, `notes`, `priority` (low, medium, high), `due` (**só o dia**, `YYYY-MM-DD`),
`tags` (até 10), `steps`, `projectId`, `repeat`, `plannedFor` (o plano do dia,
que alimenta **Today**), `partOfDay` (manhã, tarde, noite), `estimateHours`,
`realTimeHours`, `links`.

Consequências para a especificação:

- **Projeto, prazo, prioridade, tags, estimativa, dia planejado e repetição existem.**
- **Não existe hora no prazo.** O pedido "amanhã às 14h" não cabe em `due`.
- "Deadline separado de agendamento" já existe: `due` e `plannedFor`.

## Sintaxe que já existia

Em `quick-add/parser.ts`, escondida atrás do expansor "Quick-add shortcuts":

| Token | Significado |
| --- | --- |
| `#tag` | etiqueta |
| `!low`, `!medium`, `!high` | prioridade, só em inglês |
| `today`/`hoje`, `tomorrow`/`amanhã`, dia da semana por extenso, `YYYY-MM-DD` | prazo, como palavra solta |
| `@nome-do-projeto` | projeto existente |
| `~30m`, `~2h`, `~1d` | estimativa |
| `\token` | mantém o token como texto |

O documento manda dar prioridade ao que já existe. Por isso `@nome` continua
sendo projeto e as palavras soltas continuam valendo como data. O que faltava foi
somado sem quebrar nada: `+projeto`, `@data` (com hora opcional), prioridades em
português e por número, e estimativas compostas.

## Atalhos que já existiam

Nenhum atalho global. O commit `59f5587` ("Add postponement to task actions and
remove global hotkeys") tinha removido `n`, `/`, `j`, `k`, `a`, `i`, `x`, Delete
e `?`, e o teste `e2e/task-shortcuts.spec.ts` afirmava que essas teclas não
faziam nada. Restavam atalhos locais: Enter, Shift+Enter e Ctrl/⌘+Enter no
campo, Esc na busca, no painel e nos menus, setas no menu de ações.

Como o documento pede os atalhos de volta, eles voltaram com três cuidados que a
versão removida não tinha: nunca disparam durante a digitação, as teclas de
ação (Espaço, Enter, Delete) só valem com a linha da tarefa em foco, e os
atalhos de uma tecla podem ser desligados por dispositivo (WCAG 2.1.4).

## Divergências entre o documento e o repositório

| Documento | Repositório (`AGENTS.md`) | O que foi feito |
| --- | --- | --- |
| Branch `feat/ux-fluidez-inputs` | `<type>/<descrição>`, com `feature`, `fix`, `refact` ou `remove` | `feature/ux-fluidez-inputs` |
| Conventional Commits | Mensagens curtas no imperativo, sem prefixo | Mensagens no padrão do repositório |
| "lint" entre os gates | Não há linter | Gates: testes, e2e, typecheck e build |
| Relatórios em português | Interface e código em inglês, pt-BR como segundo idioma | Relatórios em português; código, testes e docs do projeto em inglês |

## Trabalho paralelo que toca os mesmos arquivos

Dois branches ainda não integrados mexem em `Composer.tsx` e
`use-board-navigation.ts`: `fix/restore-composer-details` (guarda os detalhes do
rascunho na sessão) e `fix/preserve-board-sort` (preferência de ordenação). A
persistência da ordenação por view não foi alterada aqui para não colidir com o
segundo. O primeiro vai precisar de rebase sobre o novo estado dos chips.
