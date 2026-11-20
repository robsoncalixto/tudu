# Fase 2 — Plano priorizado

Ordem por impacto e esforço. A coluna "Inventário" aponta as linhas de
[`01-inventario.md`](01-inventario.md) que cada item resolve. A ordem de
implementação seguiu a exigida pelo documento (parser, atalhos, barra, chips,
formulário, lista, demais telas).

| # | Melhoria | Inventário | Impacto | Esforço | Princípio |
| --- | --- | --- | --- | --- | --- |
| 1 | Parser com posições, datas com `@`, hora, `+projeto`, prioridade em PT e por número, estimativa composta | 3, 6 | Alto | Médio | Um campo, várias intenções |
| 2 | Registro único de atalhos, com escuta global e folha `?` | 17, 22, 23 | Alto | Médio | Teclado primeiro |
| 3 | Campo único com destaque de tokens e autocomplete (combobox) | 1, 3, 4, 6 | Alto | Alto | Feedback imediato |
| 4 | Chips no lugar do formulário, espelhando os tokens e com menus | 2, 3, 4, 5 | Alto | Alto | Divulgação progressiva |
| 5 | Enter cria na hora, limpa e mantém o foco; falha devolve o texto | 1 | Alto | Médio | Entrada em lote |
| 6 | Concluir e excluir com "Desfazer" em vez de confirmação | 11, 12, 19 | Alto | Médio | Reversível em vez de confirmado |
| 7 | Navegação da lista por teclado e ações na linha focada | 14, 17 | Alto | Baixo | Teclado primeiro |
| 8 | Edição inline do título com a mesma sintaxe | 13, 14 | Médio | Médio | Consistência |
| 9 | Mensagem flutuante, que não empurra a lista | 8 | Médio | Baixo | Sem salto de layout |
| 10 | Atalhos de navegação (`G` e letra), `N`, `/` | 20, 22 | Médio | Baixo | Teclado primeiro |
| 11 | Painel de detalhes com salvamento automático | 18 | Médio | Médio | Feedback imediato |
| 12 | Projeto criado no próprio lugar, na barra lateral | 21 | Médio | Baixo | Divulgação progressiva |
| 13 | Assistant: Enter envia, Shift+Enter quebra linha, ↑ recupera, foco volta | 24 | Médio | Baixo | Teclado primeiro |
| 14 | Carregamento com placeholders do tamanho real; totais em linha própria no celular | 27 | Baixo | Baixo | Sem salto de layout |
| 15 | Estado vazio com as teclas que o preenchem | 28 | Baixo | Baixo | Divulgação progressiva |
| 16 | Ações secundárias da linha no hover e no foco | 16 | Baixo | Baixo | Divulgação progressiva |
| 17 | Auditoria com axe e correção do que já estava errado | 9, 18, 20 | Médio | Baixo | Acessibilidade |

## Segunda rodada, após a revisão independente

A primeira entrega foi reprovada por três problemas graves: Esc nas notas
desfazendo texto salvo, o campo transbordando com mais de oito linhas e a tarefa
criada sem confirmação visível. Eles e os apontamentos menores viraram uma
segunda rodada, descrita em [`99-relatorio.md`](99-relatorio.md#revisão-independente).

## Fora do escopo

- Guardar a **hora** do prazo: depende de mudar o modelo (`due` é só o dia).
- Um **token** para repetição: o modelo tem `repeat`, mas ele exige prazo e regras
  (dias da semana, dia do mês) que não cabem bem em uma palavra. A repetição
  ficou como chip, com as quatro frequências, e parte do prazo da tarefa (ou de
  hoje, quando não há prazo); as regras detalhadas continuam no painel.

## Deixado como está, de propósito

- **Preferência de ordenação por view.** Já é lembrada por lista e por Today, com
  `localStorage` em `try/catch`. O branch `fix/preserve-board-sort` está
  refazendo esse trecho; mexer aqui criaria conflito sem ganho.
- **Data e prioridade na linha.** Continuam controles nativos, como pede
  `design.md`. Mudar o prazo pelo teclado passou a ser editar o título e digitar
  `@sex`.
