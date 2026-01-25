# Contribuindo com o MyFinanceApp

Obrigado por considerar contribuir com o **MyFinanceApp**.  
Este documento define diretrizes simples para manter o projeto organizado, consistente e fácil de evoluir.

---

## Visão Geral

O **MyFinanceApp** é o frontend do projeto MyFinance.  
Ele consome uma API externa (local ou hospedada) e foca em experiência do usuário, clareza visual e fluxo financeiro eficiente.

---

## Pré-requisitos

Antes de contribuir, você deve ter:

- Git
- Node.js (versão LTS recomendada)
- Um ambiente local funcional do frontend

---

## Configuração inicial

1. Faça um **fork** do repositório.
2. Clone o fork:

```bash
git clone https://github.com/Programador-jr/MyFinanceApp.git
cd MyFinanceApp
````

3. Instale as dependências:

```bash
npm install
```

4. Ajuste a URL da API:

A URL da API é injetada dinamicamente via `.env`:

- `GET /config.js` define `window.__API_URL__`
- `GET /config.json` retorna `{ apiUrl }`

Configure no `.env`:

* `API_URL=`

* **Produção:** `https://myfinance-oss5.onrender.com`
  (URL da API no Render)
* **Desenvolvimento local:** `http://localhost:3000`

  quando estiver rodando a **API localmente**.

> [!NOTE]
> A documentação e instruções para rodar a **API localmente** estão disponíveis no repositório da API:  
> https://github.com/Programador-jr/MyFinance

5. Inicie o frontend:

```bash
npm run dev
```

> [!IMPORTANT]
> Ao utilizar a API hospedada no Render, o frontend deve rodar na **porta 5000** (obrigatorio).

---

## Fluxo de contribuição

1. Crie uma branch a partir da `main`:

```bash
git checkout -b feature/nome-da-feature
```

2. Faça commits claros e objetivos.
3. Evite misturar refactors grandes com novas features no mesmo commit.
4. Finalize e envie sua branch:

```bash
git push origin feature/nome-da-feature
```

5. Abra um **Pull Request** descrevendo claramente:

   * O que foi alterado
   * O motivo da alteração
   * Se afeta UI, UX ou lógica

---

## Padrões de código

* **JavaScript**

  * Código legível e organizado por responsabilidade
  * Evite lógica duplicada
  * Prefira funções pequenas e claras

* **Frontend**

  * Respeite o padrão visual existente
  * Não introduza dependências novas sem justificativa
  * Evite quebrar responsividade

* **Commits**

  * Use mensagens simples e diretas
    Exemplos:

    * `feat: adiciona filtro mensal no dashboard`
    * `fix: corrige cálculo de saldo`
    * `refactor: organiza lógica de transações`

---

## O que evitar

* Commits grandes sem descrição clara
* Introduzir código morto ou não utilizado
* Alterar múltiplas áreas do app sem necessidade

---

## Reportando bugs ou sugestões

* Utilize a aba **Issues** do GitHub
* Seja claro ao descrever:

  * O problema encontrado
  * Passos para reproduzir
  * Comportamento esperado

---

## Código de conduta

* Seja respeitoso
* Feedback construtivo sempre
* Discussões técnicas devem ser objetivas

>[!NOTE]
>Veja [CODE_OF_CONDUCT](CODE_OF_CONDUCT.md) para mais detalhes

---

Obrigado por contribuir 🚀
Seu apoio ajuda a manter o MyFinanceApp evoluindo com qualidade.
