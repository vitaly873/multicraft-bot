const express = require('express');
const dgram = require('dgram');
const app = express();
const port = process.env.PORT || 3000;
app.use(express.json());
app.post('/start', (req, res) => {
  const { ip, port: serverPort, username, password } = req.body;
  if (!ip || !serverPort) {
    return res.status(400).json({ success: false, message: "Не указан IP или Порт" });
  }
  const client = dgram.createSocket('udp4');
  const handshake = Buffer.from([0x4f, 0x45, 0x74, 0x03, 0x00, 0x00, 0x00, 0x01]);
  client.send(handshake, serverPort, ip, (err) => {
    if (err) {
      client.close();
      return res.status(500).json({ success: false, message: "Ошибка отправки пакета" });
    }
    client.close();
    res.json({ success: true, message: `Бот ${username || 'Bot'} отправлен на сервер ${ip}:${serverPort}` });
  });
});
app.get('/', (req, res) => {
  res.send('MultiCraft Bot Server is running');
});
app.listen(port, () => {
  console.log(`Server started on port ${port}`);
});
