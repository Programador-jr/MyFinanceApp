<div align="center">

# MyFinanceApp  
**Controle financeiro moderno — rápido, elegante e focado em decisão.**

<a href="https://github.com/Programador-jr/MyFinanceApp/stargazers">
  <img alt="Stars" src="https://img.shields.io/github/stars/Programador-jr/MyFinanceApp?style=for-the-badge">
</a>
<a href="https://github.com/Programador-jr/MyFinanceApp/network/members">
  <img alt="Forks" src="https://img.shields.io/github/forks/Programador-jr/MyFinanceApp?style=for-the-badge">
</a>
<a href="https://github.com/Programador-jr/MyFinanceApp/issues">
  <img alt="Issues" src="https://img.shields.io/github/issues/Programador-jr/MyFinanceApp?style=for-the-badge">
</a>
<a href="https://github.com/Programador-jr/MyFinanceApp/blob/main/LICENSE">
  <img alt="License" src="https://img.shields.io/github/license/Programador-jr/MyFinanceApp?style=for-the-badge">
</a>

<br/>

<!-- Card com estatísticas do repositório -->
<a href="https://github-readme-stats.vercel.app/api/pin/?username=Programador-jr&repo=MyFinanceApp&theme=tokyonight">
  <img alt="Repo Card" src="https://github-readme-stats.vercel.app/api/pin/?username=Programador-jr&repo=MyFinanceApp&theme=tokyonight" />
</a>

</div>

---

## Sobre

**MyFinanceApp** é um aplicativo web de controle financeiro pessoal e familiar com painel intuitivo, gráficos, categorias e metas (“caixinhas”). O foco é simplicidade e clareza na visualização de entradas, saídas e desempenho financeiro ao longo do tempo.

---

## Funcionalidades

- Dashboard com saldo, entradas e saídas  
- Gráficos de tendência e distribuição por categoria  
- CRUD de transações  
- Gestão de categorias  
- Caixinhas para metas e reservas  
- Autenticação completa (login, registro, verificação e reset de senha)  
- PWA com suporte offline e instalação  
- Tema claro/escuro conforme preferência

---

## Tecnologias

- HTML, CSS (Bootstrap)  
- JavaScript  
- Chart.js  
- Service Worker + Manifest para PWA

---

## Instalação

```bash
git clone https://github.com/Programador-jr/MyFinanceApp.git
cd MyFinanceApp
npm install
npm run dev
````

O frontend será iniciado na porta **5000** por padrão.

---

## Configuração da API (frontend)

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

> [!IMPORTANT]
> Ao utilizar a API hospedada no Render, o frontend deve rodar na porta 5000.

---

## Uso

1. Após iniciar o frontend, abra:

   ```
   http://localhost:5000
   ```
2. Faça login ou cadastre uma conta.
3. Explore o dashboard, adicione transações, categorias e caixinhas.

---

## Contribuição

Quer contribuir com o MyFinanceApp? Siga estes passos:

1. Faça *fork* deste repositório.
2. Crie uma branch de feature:

   ```bash
   git checkout -b feature/nome-da-feature
   ```
3. Faça seus commits e abra um *Pull Request*.

> [!NOTE]
> Mais informações em [CONTRIBUTING](CONTRIBUTING.md)

---

## Licença

Este projeto está sob a **ISC License**. Veja o arquivo [LICENSE](LICENSE) para mais detalhes.
