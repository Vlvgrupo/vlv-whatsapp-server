const express = require('express');
const axios = require('axios');
const fs = require('fs');
const app = express();
app.use(express.json());

const ZAPI_INSTANCE = '3F158C331D8A326B611D2295B0810B48';
const ZAPI_TOKEN = '8FB78AC69420CCDE31F20255';
const ZAPI_CLIENT_TOKEN = 'F0eecc90b25204a33a8c3aa13f8a18969S';
const ZAPI_URL = `https://api.z-api.io/instances/${ZAPI_INSTANCE}/token/${ZAPI_TOKEN}`;
const ZAPI_HEADERS = { 'Client-Token': ZAPI_CLIENT_TOKEN };
const DB_FILE = '/tmp/conversations.json';

// Carregar conversas salvas
function loadConv() {
  try { return JSON.parse(fs.readFileSync(DB_FILE, 'utf8')); } 
  catch(e) { return {}; }
}
function saveConv(data) {
  try { fs.writeFileSync(DB_FILE, JSON.stringify(data)); } catch(e) {}
}

let conversations = loadConv();

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

app.get('/', (req, res) => res.json({ status: 'VLV WhatsApp Server Online', conversas: Object.keys(conversations).length }));

app.post('/webhook', async (req, res) => {
  try {
    const body = req.body;
    console.log('WEBHOOK:', JSON.stringify(body).substring(0, 200));
    const phone = String(body.phone || body.from || '').replace(/\D/g, '').replace(/^55/, '');
    if (!phone) return res.sendStatus(200);
    const message = body.text?.message || body.message?.text || body.message || body.body || body.caption || '';
    if (!message) return res.sendStatus(200);
    const fromMe = body.fromMe === true || body.fromMe === 'true';
    const senderName = body.senderName || body.pushname || (fromMe ? 'Consultor' : 'Lead');
    const timestamp = new Date().toLocaleString('pt-BR');
    if (!conversations[phone]) conversations[phone] = { phone, name: senderName, messages: [] };
    conversations[phone].messages.push({ text: message, fromMe, time: timestamp, senderName, ts: Date.now() });
    // Limitar a 200 mensagens por conversa
    if (conversations[phone].messages.length > 200) conversations[phone].messages = conversations[phone].messages.slice(-200);
    saveConv(conversations);
    console.log(`✓ ${fromMe ? 'Enviada' : 'Recebida'} de ${phone}: ${message}`);
    res.sendStatus(200);
  } catch (e) {
    console.error('Erro webhook:', e);
    res.sendStatus(500);
  }
});

app.get('/conversa/:phone', (req, res) => {
  const phone = req.params.phone.replace(/\D/g, '').replace(/^55/, '');
  const alt = phone.replace(/^(\d{2})9(\d{8})$/, '$1$2');
  const conv = conversations[phone] || conversations[alt] || { phone, messages: [] };
  res.json(conv);
});

app.get('/conversas', (req, res) => {
  const lista = Object.values(conversations).map(c => ({
    ...c,
    messages: c.messages.slice(-50) // últimas 50 por padrão
  }));
  res.json(lista);
});

app.post('/enviar', async (req, res) => {
  try {
    const { phone, message } = req.body;
    if (!phone || !message) return res.status(400).json({ error: 'phone e message obrigatorios' });
    const phoneClean = phone.replace(/\D/g, '');
    const response = await axios.post(`${ZAPI_URL}/send-text`, { phone: phoneClean, message }, { headers: ZAPI_HEADERS });
    const phoneKey = phoneClean.replace(/^55/, '');
    const timestamp = new Date().toLocaleString('pt-BR');
    if (!conversations[phoneKey]) conversations[phoneKey] = { phone: phoneKey, messages: [] };
    conversations[phoneKey].messages.push({ text: message, fromMe: true, time: timestamp, senderName: 'Consultor', ts: Date.now() });
    saveConv(conversations);
    res.json({ success: true, data: response.data });
  } catch (e) {
    console.error('Erro enviar:', e.response?.data || e.message);
    res.status(500).json({ error: e.response?.data || e.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`VLV Server rodando na porta ${PORT}`));
