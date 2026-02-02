# Bug: saldo do dashboard fica filtrado por mês

### Descrição
No dashboard, o saldo total está sendo filtrado pelo mês selecionado, quando deveria considerar o saldo acumulado geral. Isso gera valores zerados ou negativos indevidos ao mudar de mês.

### Objetivo

- [ ] Qual problema será resolvido: o saldo do dashboard não deve ser recalculado somente com o mês filtrado.
- [ ] Qual melhoria será entregue ao usuário: exibir o saldo acumulado geral no dashboard, mantendo o filtro mensal apenas na lista de transações.

### Implementações

- [ ] O que será feito tecnicamente: ajustar a lógica de cálculo do saldo no dashboard para não aplicar o filtro mensal.
- [ ] Arquivos, páginas ou fluxos afetados: dashboard (saldo total) e lógica de cálculo de saldo.

### Observações

- Limitações conhecidas: o filtro mensal continuará valendo apenas para a listagem de transações.
- Decisões técnicas importantes: manter o saldo do dashboard independente do filtro por período.
