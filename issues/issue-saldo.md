# Bug: saldo do dashboard fica filtrado por mês

## Descrição
No dashboard, o saldo total fica sendo filtrado pelo mês selecionado, quando deveria considerar o saldo acumulado geral. Isso gera valores zerados ou negativos indevidos ao mudar de mês.

## Passos para reproduzir
1. Acesse o dashboard do MyFinanceApp.
2. Tenha um saldo positivo no fim de janeiro (ex.: R$ 27,00).
3. Troque o filtro para fevereiro.
4. Registre apenas uma saída em fevereiro (ex.: -R$ 15,00) e nenhuma entrada.

## Comportamento atual
O saldo do dashboard é recalculado somente com as transações do mês filtrado. Em fevereiro o saldo aparece como R$ 0,00 e depois -R$ 15,00, ignorando o saldo acumulado de janeiro.

## Comportamento esperado
O saldo do dashboard deve representar o saldo acumulado geral, independente do mês filtrado. O filtro mensal pode continuar sendo aplicado apenas na listagem de transações.

## Informações adicionais
- Ambiente: navegador Chrome / Firefox
- Reprodutível em múltiplas sessões
- Impacta o resumo financeiro do usuário
