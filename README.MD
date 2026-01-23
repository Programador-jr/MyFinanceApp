# MyFinance

MyFinance e um app web para controle financeiro pessoal e familiar. Centraliza entradas, saidas, metas e organizacao em um painel claro e rapido, com foco em experiencia premium.

## Destaques
- Dashboard com saldo, entradas e saidas em tempo real
- Graficos de tendencia e distribuicao por categoria
- Transacoes com filtros por periodo e edicao rapida
- Categorias personalizaveis
- Caixinhas para objetivos, reservas e emergencias
- Fluxo completo de autenticacao (login, cadastro, recuperacao e verificacao)
- PWA com instalacao customizada e modo offline

## Principais telas
- Login e cadastro
- Dashboard
- Lancamentos
- Categorias
- Caixinhas

## Stack
- HTML, CSS, JavaScript
- Bootstrap 5 + Font Awesome
- Chart.js
- Node.js + Express (server)
- Service Worker + Manifest (PWA)

## Como rodar local
1) Instale as dependencias:
   - `npm install`
2) Inicie o servidor:
   - `npm start`

Abra `http://localhost:3000` (ou a porta configurada no servidor).

## Variaveis de ambiente
Crie `.env` ou `.env.local` conforme necessario.
- `PORT` (opcional)
- `API_URL` (opcional, se quiser sobrescrever o backend)

## Estrutura (resumo)
- `public/` assets, paginas e scripts do front
- `server.js` servidor Express

## Deploy
Projeto pronto para deploy em plataformas de hosting estatico com Node (ex.: Vercel).

## Licenca
ISC. Consulte `LICENSE`.
