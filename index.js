const express = require('express');
const dgram = require('dgram');
const app = express();
const port = process.env.PORT || 3000;
app.use(express.json());
app.post('/start', async (req, res) => {
  const { inviteCode, serverIp, serverPort, username, password, autoLogin } = req.body;
  let ip = serverIp;
  let portVal = serverPort;
  if (!ip || !portVal) {
    if (!inviteCode) {
      return res.status(400).json({ success: false, message: "Укажите IP/Порт или Инвайт код" });
    }
    try {
      const response = await fetch("https://servers.multicraft.network/list", {
        headers: { "User-Agent": "MultiCraft/1.0", "Accept": "application/json" }
      });
      if (!response.ok) {
        return res.status(500).json({ success: false, message: "Ошибка получения списка серверов" });
      }
      const servers = await response.json();
      const server = servers.find(s => s.id === inviteCode || s.code === inviteCode);
      if (!server) {
        return res.status(404).json({ success: false, message: "Код не найден в списке" });
      }
      ip = server.ip || server.address;
      portVal = server.port;
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }
  const botName = autoLogin ? "Bot_" + Math.random().toString(36).substring(7) : username;
  const client = dgram.createSocket('udp4');
  let peerId = 0;
  const protocolId = Buffer.from([0x4f, 0x45, 0x74, 0x03]);
  const initPacket = Buffer.concat([
    protocolId,
    Buffer.from([0x00, 0x00]),
    Buffer.from([0x00]),
    Buffer.from([0x00]),
    Buffer.from([0x00, 0x1c, 0x00, 0x00, 0x00, 0x02])
  ]);
  client.on('message', (msg, rinfo) => {
    if (msg.length >= 8) {
      const type = msg[6];
      if (type === 0x01) {
        peerId = msg.readUInt16BE(4);
        const loginData = Buffer.from(JSON.stringify({ name: botName, password: password }));
        const loginPacket = Buffer.concat([
          protocolId,
          Buffer.from([0x00, 0x01]),
          Buffer.from([0x00]),
          Buffer.from([0x01]),
          loginData
        ]);
        client.send(loginPacket, portVal, ip);
      }
    }
  });
  client.send(initPacket, portVal, ip, (err) => {
    if (err) {
      client.close();
      return res.status(500).json({ success: false, message: "Не удалось отправить пакет" });
    }
    const pingInterval = setInterval(() => {
      if (peerId !== 0) {
        const pingPacket = Buffer.concat([
          protocolId,
          Buffer.from([0x00, 0x01]),
          Buffer.from([0x00]),
          Buffer.from([0x03])
        ]);
        client.send(pingPacket, portVal, ip);
      }
    }, 5000);
    setTimeout(() => {
      clearInterval(pingInterval);
      client.close();
    }, 120000);
    res.json({ success: true, message: `Бот ${botName} успешно вошел и активен на сервере ${ip}:${portVal}` });
  });
});
app.get('/', (req, res) => {
  res.send('MultiCraft Bot Running');
});
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
