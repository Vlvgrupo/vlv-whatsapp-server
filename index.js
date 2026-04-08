const express = require('express');
const axios = require('axios');
const app = express();
app.use(express.json());

const ZAPI_INSTANCE = '3F158C331D8A326B611D2295B0810B48';
const ZAPI_TOKEN = '8FB78AC69420CCDE31F20255';
const ZAPI_CLIENT_TOKEN = 'F0eecc90b25204a33a8c3aa13f8a18969S';
const ZAPI_URL = `https://api.z-api.io/instances/${ZAPI_INSTANCE}/token/${ZAPI_TOKEN}`;
const ZAPI_HEADERS = { 'Client-Token': ZAPI_CLIENT_TOKEN };

let conversations = {};

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

app.get('/', (req, res) => res.json({ status: 'VLV WhatsApp Server Online' }));

app.post('/webhook', async (req, res) => {
  try {
    const body = req.body;
    console.log('WEBHOOK recebido:', JSON.stringify(body).substring(0, 300));

    // Extrai telefone — Z-API manda "phone" ou "from"
    const phone = String(body.phone || body.from || '').replace(/\D/g, '').replace(/^55/, '');
    if (!phone) return res.sendStatus(200);

    // Extrai texto — múltiplos formatos possíveis da Z-API
    const message =
      body.text?.message ||
      body.message?.text ||
      body.message ||
      body.body ||
      body.caption || '';

    if (!message) return res.sendStatus(200);

    const fromMe = body.fromMe === true || body.fromMe === 'true';
    const senderName = body.senderName || body.pushname || (fromMe ? 'Consultor' : 'Lead');
    const timestamp = new Date().toLocaleString('pt-BR');
    const phoneKey = phone.replace(/^55/, '');

    if (!conversations[phoneKey]) conversations[phoneKey] = { phone: phoneKey, name: senderName, messages: [] };
    conversations[phoneKey].messages.push({ text: message, fromMe, time: timestamp, senderName });

    console.log(`✓ Msg ${fromMe ? 'enviada' : 'recebida'} de ${phoneKey}: ${message}`);
    res.sendStatus(200);
  } catch (e) {
    console.error('Erro webhook:', e);
    res.sendStatus(500);
  }
});

app.get('/conversa/:phone', (req, res) => {
  const phone = req.params.phone.replace(/\D/g, '').replace(/^55/, '');
  // Tenta com e sem 55 e com/sem 9
  const conv = conversations[phone] ||
    conversations['55' + phone] ||
    conversations[phone.replace(/^(\d{2})9(\d{8})$/, '$1$2')] ||
    { phone, messages: [] };
  res.json(conv);
});

app.get('/conversas', (req, res) => res.json(Object.values(conversations)));

app.post('/enviar', async (req, res) => {
  try {
    const { phone, message } = req.body;
    if (!phone || !message) return res.status(400).json({ error: 'phone e message obrigatorios' });
    const phoneClean = phone.replace(/\D/g, '');
    const response = await axios.post(
      `${ZAPI_URL}/send-text`,
      { phone: phoneClean, message },
      { headers: ZAPI_HEADERS }
    );
    const timestamp = new Date().toLocaleString('pt-BR');
    const phoneKey = phoneClean.replace(/^55/, '');
    if (!conversations[phoneKey]) conversations[phoneKey] = { phone: phoneKey, messages: [] };
    conversations[phoneKey].messages.push({ text: message, fromMe: true, time: timestamp, senderName: 'Consultor' });
    res.json({ success: true, data: response.data });
  } catch (e) {
    console.error('Erro enviar:', e.response?.data || e.message);
    res.status(500).json({ error: e.response?.data || e.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`VLV Server rodando na porta ${PORT}`));
