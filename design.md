# Design — Chaveamento Fácil

## Conceito

Duas linguagens visuais convivendo, cada uma com um propósito:

1. **App shell (escuro)** — dashboard, listagem de torneios, wizard de criação, login. Baseado na imagem de inspiração enviada: fundo grafite profundo, cartões elevados com faixa colorida no topo, acento coral/vermelho para ações primárias.
2. **Folha de chaveamento (clara)** — a view do bracket é uma "folha de papel" branca dentro do app escuro, idêntica ao PDF A4 de referência. Isso garante que o que aparece na tela é exatamente o que sai na impressora.

## Cores

```css
/* App shell — escuro */
--ink-900: #101216   /* fundo da página */
--ink-800: #16181d   /* superfícies */
--ink-700: #1d2027   /* cartões */
--ink-600: #262a33   /* bordas / hover */
--ink-500: #363b47   /* bordas fortes */
--text-hi:  #f2f4f7
--text-mid: #a4acbb
--text-low: #6b7385

/* Acentos */
--coral: #f0435a     /* ação primária, destaque */
--coral-dim: #c9364a
--teal:  #12a594     /* vencedor, sucesso, seeds */
--amber: #f6b13c     /* aviso, em andamento */
--violet:#8a7bf0     /* faixa decorativa de cartão */

/* Folha clara (bracket + impressão) */
--paper:        #ffffff
--paper-line:   #dfe3e8   /* conectores e bordas de slot */
--paper-slot:   #f4f6f8   /* fundo de slot vazio */
--paper-ink:    #1b2129
--paper-muted:  #8b95a1
--paper-win-bg: #e6f4f1   /* fundo do vencedor */
--paper-win-bar:#12a594   /* barra esquerda do vencedor */
```

Faixa colorida no topo dos cartões de torneio rotaciona entre `teal`, `coral`, `violet`, `amber` de acordo com o hash do id — dá variedade sem aleatoriedade instável.

## Tipografia

- **Display:** `Outfit` (600/700) — títulos, números de placar, nome do torneio.
- **Corpo:** `Poppins` (400/500/600) — textos, labels, tabelas.
- **Folha de chaveamento:** também `Poppins`, mas com `letter-spacing: 0.08em` + `uppercase` nos rótulos de rodada (`ROUND 1`, `LOSERS FINAL`), replicando o A4 de referência.
- Escala: 12/13/14/16/20/28/40. Line-height generoso (1.5 no corpo, 1.15 nos títulos).

## Layout

- Container central `max-w-6xl` no shell; a folha do bracket é `overflow-x-auto` com largura própria.
- Header fixo escuro, 64px, com marca à esquerda e sessão à direita.
- Lista de torneios: grid `sm:2 lg:3` de cartões com faixa superior de 4px, nome, formato, nº de participantes, data e ações.
- Wizard de criação em passos verticais numerados (sem multi-página) — tudo visível, sem navegação escondida.
- Bracket: colunas por rodada, largura fixa de 240px por coluna, conectores desenhados com bordas CSS (não SVG) para imprimir sem falhas.

## Componentes

- `MatchBox` — dois slots empilhados; cada slot mostra `#seed`, nome (ou rótulo de origem em itálico cinza quando indefinido) e placar à direita. Vencedor recebe `--paper-win-bg` + barra esquerda `--paper-win-bar`.
- `ScoreDialog` — modal escuro com dois campos numéricos grandes, nomes dos jogadores e botões Salvar / Limpar.
- `GroupStandings` — tabela clara: Pos, Jogador, J, V, E, D, PP, PC, SP, Pts.
- `TournamentCard` — cartão do dashboard.
- `PrintSheet` — wrapper que aplica `@page { size: A4 landscape; margin: 8mm }` e esconde o resto na impressão.

## Movimento

Uma orquestração no carregamento: cartões e colunas do bracket entram com fade + translate-y de 8px, stagger de 40ms, via CSS `@keyframes` e `animation-delay` inline. Sem micro-interações espalhadas. Botões: transição de 150ms em background/border. `prefers-reduced-motion` desativa tudo.

## Anti-padrões evitados

Sem gradientes roxos sobre branco, sem grid previsível de cards arredondados idênticos, sem Inter/Roboto/Space Grotesk. Densidade controlada: o bracket é denso de propósito (é um documento), o shell é arejado.
