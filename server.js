const express = require('express');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT;
const IP_ADDRESS = process.env.IP_ADDRESS;

app.use(express.static(path.join(__dirname, 'public')));

const PROFILE_COLORS_FILE = path.join(__dirname, 'profile-colors.json');
const DEFAULT_PROFILE_COLORS = {
  default: 'blue',
  colors: [
    { key: 'blue', label: 'Azul', hex: '#3b82f6' },
    { key: 'purple', label: 'Roxo', hex: '#4a24a3' },
    { key: 'yellow', label: 'Amarelo', hex: '#f59e0b' },
    { key: 'red', label: 'Vermelho', hex: '#ef4444' }
  ]
};

function sanitizeProfileColorsConfig(raw) {
  if (!raw || typeof raw !== 'object') return DEFAULT_PROFILE_COLORS;

  const inputColors = Array.isArray(raw.colors) ? raw.colors : [];
  const normalizedColors = inputColors
    .map((item) => {
      const key = String(item?.key || '').trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
      const hex = String(item?.hex || '').trim();
      const label = String(item?.label || '').trim();
      if (!key || !/^#([0-9a-fA-F]{6})$/.test(hex)) return null;
      return { key, hex, label: label || hex };
    })
    .filter(Boolean);

  if (!normalizedColors.length) return DEFAULT_PROFILE_COLORS;

  const defaultKeyRaw = String(raw.default || '').trim().toLowerCase();
  const defaultKey = normalizedColors.some((color) => color.key === defaultKeyRaw)
    ? defaultKeyRaw
    : normalizedColors[0].key;

  return { default: defaultKey, colors: normalizedColors };
}

function loadProfileColorsConfig() {
  try {
    const raw = fs.readFileSync(PROFILE_COLORS_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    return sanitizeProfileColorsConfig(parsed);
  } catch {
    return DEFAULT_PROFILE_COLORS;
  }
}

app.get('/config.js', (req, res) => {
  res.set('Cache-Control', 'no-store');
  res.type('application/javascript');
  const profileColors = loadProfileColorsConfig();
  res.send(
    `window.__API_URL__ = ${JSON.stringify(process.env.API_URL || '')};\n` +
    `window.__MF_PROFILE_COLORS = ${JSON.stringify(profileColors)};`
  );
});

app.get('/config.json', (req, res) => {
  res.set('Cache-Control', 'no-store');
  res.json({ apiUrl: process.env.API_URL || '' });
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, IP_ADDRESS, () => {
  console.log(`Frontend rodando em http://${IP_ADDRESS}:${PORT}`);
});
