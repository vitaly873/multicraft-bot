const express = require('express');
const dgram = require('dgram');
const http = require('http');
const https = require('https');
const app = express();
const port = process.env.PORT || 3000;
app.use(express.json());
async function getIpByInvite(inviteCode) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'servers.multicraft.network',
      port: 443,
      path: '/list',
      method: 'GET',
      headers: {
        'User-Agent': 'MultiCraft/1.0',
        'Accept': 'application/json'
      }
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode !== 200) {
          reject(new Error(`Server error: ${res.statusCode}`));
          return;
        }
        try {
          const servers = JSON.parse(data);
          const server = servers.find(s => s.id === inviteCode || s.code === inviteCode);
          if (server) {
            resolve({
              ip: server.ip || server.address,
              port: server.port
            });
          } else {
            reject(new Error("Код не найден в списке"));
          }
        } catch (e) {
          reject(e);
        }
      });
    });
    req.on('error', (e) => { reject(e); });
    req.end();
  });
}
app.post('/start', async (req, res) => {
  const { inviteCode, ip: reqIp, port: reqPort, username, password, botCount, afkJump, afkSpin, ownerNick } = req.body;
  let targetIp = reqIp;
  let targetPort = reqPort;
  if (!targetIp || !targetPort) {
    if (!inviteCode) {
      return res.status(400).json({ success: false, message: "Не указан IP/Порт или Инвайт код" });
    }
    try {
      const resolved = await getIpByInvite(inviteCode);
      targetIp = resolved.ip;
      targetPort = resolved.port;
    } catch (err) {
      return res.status(500).json({ success: false, message: `Ошибка поиска инвайта на Render: ${err.message}` });
    }
  }
  const count = parseInt(botCount) || 1;
  const activeBots = [];
  for (let i = 0; i < count; i++) {
    const botName = count > 1 ? `${username}_${i}` : username;
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
    client.on('message', (msg) => {
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
          client.send(loginPacket, targetPort, targetIp);
        }
      }
    });
    client.send(initPacket, targetPort, targetIp);
    const pingInterval = setInterval(() => {
      if (peerId !== 0) {
        const pingPacket = Buffer.concat([
          protocolId,
          Buffer.from([0x00, 0x01]),
          Buffer.from([0x00]),
          Buffer.from([0x03])
        ]);
        client.send(pingPacket, targetPort, targetIp);
      }
    }, 5000);
    setTimeout(() => {
      clearInterval(pingInterval);
      client.close();
    }, 120000);
    activeBots.push(botName);
  }
  res.json({
    success: true,
    message: `Запущено ботов: ${activeBots.join(', ')} на сервере ${targetIp}:${targetPort}`
  });
});
app.get('/', (req, res) => {
  res.send('MultiCraft Bot Server is running');
});
app.listen(port, () => {
  console.log(`Server started on port ${port}`);
}); 
