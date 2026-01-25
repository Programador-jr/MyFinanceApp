const express = require('express');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(express.static(path.join(__dirname, 'public')));

app.get('/config.js', (req, res) => {
  res.set('Cache-Control', 'no-store');
  res.type('application/javascript');
  res.send(
    `window.__API_URL__ = ${JSON.stringify(process.env.API_URL || '')};`
  );
});

app.get('/config.json', (req, res) => {
  res.set('Cache-Control', 'no-store');
  res.json({ apiUrl: process.env.API_URL || '' });
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Frontend rodando em http://localhost:${PORT}`);
});
