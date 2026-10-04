import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import SerialPort from 'serialport';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CONFIG_PATH = path.join(__dirname, 'config.js');
const HTTP_PORT = 3456;

var activePort = null;
var logs = [];
var maxLogs = 100;

function addLog(type, msg) {
  var entry = { time: new Date().toLocaleTimeString(), type: type, msg: msg };
  logs.push(entry);
  if (logs.length > maxLogs) logs.shift();
}

function getAvailablePorts(cb) {
  SerialPort.list().then(function (ports) {
    cb(null, ports);
  }).catch(function (err) {
    cb(err, []);
  });
}

function readConfig(cb) {
  fs.readFile(CONFIG_PATH, 'utf8', function (err, data) {
    if (err) return cb(err, null);
    try {
      var cfg = {};
      var m;
      m = data.match(/portName:\s*'([^']+)'/);
      cfg.portName = m ? m[1] : 'COM1';
      m = data.match(/baudRate:\s*(\d+)/);
      cfg.baudRate = m ? parseInt(m[1]) : 9600;
      m = data.match(/dataBits:\s*(\d+)/);
      cfg.dataBits = m ? parseInt(m[1]) : 8;
      m = data.match(/parity:\s*'([^']+)'/);
      cfg.parity = m ? m[1] : 'none';
      m = data.match(/stopBits:\s*(\d+)/);
      cfg.stopBits = m ? parseInt(m[1]) : 1;
      m = data.match(/typeLoadcell:\s*'([^']+)'/);
      cfg.typeLoadcell = m ? m[1] : '';
      cb(null, cfg);
    } catch (e) {
      cb(e, null);
    }
  });
}

function writeConfig(cfg, cb) {
  fs.readFile(CONFIG_PATH, 'utf8', function (err, data) {
    if (err) return cb(err);
    var out = data;
    out = out.replace(/portName:\s*'[^']+'/, "portName: '" + cfg.portName + "'");
    out = out.replace(/baudRate:\s*\d+/, "baudRate: " + cfg.baudRate);
    out = out.replace(/dataBits:\s*\d+/, "dataBits: " + cfg.dataBits);
    out = out.replace(/(^\s*parity:\s*)'[^']+'/m, "$1'" + cfg.parity + "'");
    out = out.replace(/stopBits:\s*\d+/, "stopBits: " + cfg.stopBits);
    fs.writeFile(CONFIG_PATH, out, 'utf8', cb);
  });
}

function stopPort() {
  if (activePort) {
    try {
      activePort.removeAllListeners();
      if (activePort.isOpen) activePort.close();
    } catch (e) { /* ignore */ }
    activePort = null;
    addLog('info', 'Serial port stopped');
  }
}

function startTest(cfg) {
  stopPort();
  addLog('info', 'Opening ' + cfg.portName + ' @ ' + cfg.baudRate + '/' + cfg.dataBits + '/' + cfg.parity + '/' + cfg.stopBits);

  activePort = new SerialPort(cfg.portName, {
    baudRate: parseInt(cfg.baudRate),
    dataBits: parseInt(cfg.dataBits),
    parity: cfg.parity,
    stopBits: parseInt(cfg.stopBits),
    flowControl: false
  });

  activePort.on('error', function (err) {
    addLog('error', 'Error: ' + err.message);
  });

  activePort.on('close', function () {
    addLog('info', 'Port closed');
  });

  activePort.on('open', function () {
    addLog('ok', 'Port opened successfully!');

    var buffer = '';
    activePort.on('data', function (data) {
      var hex = data.toString('hex');
      var ascii = data.toString('latin1').replace(/[^\x20-\x7E]/g, '.');
      addLog('data', 'HEX: ' + hex + '  ASCII: ' + ascii);

      buffer += data.toString('latin1');
      if (buffer.length > 200) buffer = buffer.slice(-100);

      var clean = buffer.replace(/[^\x20-\x7E]/g, '');
      var digits = clean.match(/[+-]([\s\d]{5,7})/);
      if (digits) {
        var w = digits[1].trim();
        if (/^\d+$/.test(w)) {
          addLog('ok', 'Weight detected: ' + w);
          buffer = '';
        }
      }
    });
  });
}

var HTML = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Serial Tester</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:Segoe UI,sans-serif;background:#1e1e2e;color:#cdd6f4;padding:12px;height:100vh;display:flex;flex-direction:column;overflow:hidden}
h2{color:#89b4fa;font-size:15px;margin-bottom:10px}
.top{display:flex;gap:8px;align-items:center;flex-wrap:wrap;background:#313244;padding:10px 12px;border-radius:6px;margin-bottom:10px}
.top label{color:#a6adc8;font-size:11px;margin-right:2px}
.top select{padding:4px 6px;background:#1e1e2e;color:#cdd6f4;border:1px solid #45475a;border-radius:4px;font-size:12px;font-family:inherit}
.top .sep{width:1px;height:24px;background:#45475a;margin:0 4px}
button{padding:5px 14px;border:none;border-radius:4px;cursor:pointer;font-size:12px;font-weight:600;font-family:inherit}
.btn-test{background:#a6e3a1;color:#1e1e2e}
.btn-stop{background:#f38ba8;color:#1e1e2e}
.btn-save{background:#89b4fa;color:#1e1e2e}
.btn-scan{background:#fab387;color:#1e1e2e;font-size:11px;padding:4px 8px}
.btn-clr{background:transparent;color:#6c7086;border:1px solid #45475a;font-size:11px;padding:3px 8px}
.monitor{flex:1;display:flex;flex-direction:column;min-height:0}
.monitor-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:6px}
.monitor-head span{color:#a6adc8;font-size:11px}
#log{flex:1;overflow-y:auto;background:#11111b;border:1px solid #313244;border-radius:6px;padding:8px;font-family:Consolas,monospace;font-size:11px;line-height:1.7}
.log-ok{color:#a6e3a1}
.log-error{color:#f38ba8}
.log-data{color:#f9e2af}
.log-info{color:#89dceb}
#status{display:inline-block;padding:3px 10px;border-radius:10px;font-size:11px;font-weight:600}
.st-off{background:#45475a;color:#6c7086}
.st-on{background:#a6e3a1;color:#1e1e2e}
</style>
</head>
<body>
<h2><span id="status" class="st-off">OFF</span> Serial Port Tester</h2>
<div class="top">
  <label>Port</label><select id="port" style="width:90px"><option>COM1</option></select>
  <button class="btn-scan" onclick="scanPorts()">Scan</button>
  <div class="sep"></div>
  <label>Baud</label><select id="baud" style="width:75px">
    <option>1200</option><option>2400</option><option>4800</option>
    <option selected>9600</option><option>19200</option><option>38400</option>
    <option>57600</option><option>115200</option></select>
  <label>Bits</label><select id="databits" style="width:44px"><option>7</option><option selected>8</option></select>
  <label>Parity</label><select id="parity" style="width:65px">
    <option value="none">None</option><option value="even">Even</option><option value="odd">Odd</option></select>
  <label>Stop</label><select id="stopbits" style="width:44px"><option selected>1</option><option>2</option></select>
  <div class="sep"></div>
  <button class="btn-test" onclick="startTest()">Test</button>
  <button class="btn-stop" onclick="stopTest()">Stop</button>
  <button class="btn-save" onclick="saveConfig()">Save</button>
</div>
<div class="monitor">
  <div class="monitor-head"><span>Serial Monitor</span><button class="btn-clr" onclick="clearLog()">Clear</button></div>
  <div id="log"></div>
</div>
<script>
var polling=null;
function api(url,body,cb){
  var opts={method:body?'POST':'GET'};
  if(body)opts.body=JSON.stringify(body);
  fetch(url,opts).then(r=>r.json()).then(cb).catch(e=>console.error(e));
}
function scanPorts(){
  api('/api/ports',null,function(d){
    var sel=document.getElementById('port');
    var cur=sel.value;
    sel.innerHTML='';
    d.ports.forEach(function(p){
      var o=document.createElement('option');
      o.value=p.path;o.text=p.path+(p.manufacturer?' - '+p.manufacturer:'');
      sel.appendChild(o);
    });
    if(cur)sel.value=cur;
  });
}
function loadConfig(){
  api('/api/config',null,function(d){
    document.getElementById('port').value=d.portName;
    document.getElementById('baud').value=d.baudRate;
    document.getElementById('databits').value=d.dataBits;
    document.getElementById('parity').value=d.parity;
    document.getElementById('stopbits').value=d.stopBits;
  });
}
function startTest(){
  var cfg={
    portName:document.getElementById('port').value,
    baudRate:document.getElementById('baud').value,
    dataBits:document.getElementById('databits').value,
    parity:document.getElementById('parity').value,
    stopBits:document.getElementById('stopbits').value
  };
  api('/api/start',cfg,function(){
    document.getElementById('status').className='status status-on';
    document.getElementById('status').textContent='CONNECTED';
    startPolling();
  });
}
function stopTest(){
  api('/api/stop',{},function(){
    document.getElementById('status').className='status status-off';
    document.getElementById('status').textContent='DISCONNECTED';
    stopPolling();
  });
}
function saveConfig(){
  var cfg={
    portName:document.getElementById('port').value,
    baudRate:document.getElementById('baud').value,
    dataBits:document.getElementById('databits').value,
    parity:document.getElementById('parity').value,
    stopBits:document.getElementById('stopbits').value
  };
  api('/api/save',cfg,function(d){
    if(d.ok)alert('Config saved to config.js!');
    else alert('Error: '+d.error);
  });
}
function clearLog(){document.getElementById('log').innerHTML='';api('/api/clear',{},function(){});}
function startPolling(){
  stopPolling();
  polling=setInterval(fetchLogs,300);
}
function stopPolling(){if(polling){clearInterval(polling);polling=null;}}
var lastCount=0;
function fetchLogs(){
  api('/api/logs?after='+lastCount,null,function(d){
    var el=document.getElementById('log');
    d.logs.forEach(function(l){
      var div=document.createElement('div');
      div.className='log-'+l.type;
      div.textContent='['+l.time+'] '+l.msg;
      el.appendChild(div);
    });
    lastCount=d.total;
    if(d.logs.length>0)el.scrollTop=el.scrollHeight;
  });
}
scanPorts();loadConfig();startPolling();
</script>
</body>
</html>`;

var server = http.createServer(function (req, res) {
  if (req.method === 'GET' && (req.url === '/' || req.url === '/index.html')) {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(HTML);
    return;
  }

  if (req.method === 'GET' && req.url === '/api/ports') {
    getAvailablePorts(function (err, ports) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ports: ports.map(function (p) { return { path: p.path, manufacturer: p.manufacturer || '' }; }) }));
    });
    return;
  }

  if (req.method === 'GET' && req.url === '/api/config') {
    readConfig(function (err, cfg) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(cfg || {}));
    });
    return;
  }

  if (req.method === 'GET' && req.url.startsWith('/api/logs')) {
    var after = parseInt((req.url.match(/after=(\d+)/) || [])[1] || '0');
    var newLogs = logs.slice(Math.max(0, after));
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ logs: newLogs, total: logs.length }));
    return;
  }

  if (req.method === 'POST') {
    var body = '';
    req.on('data', function (chunk) { body += chunk; });
    req.on('end', function () {
      var data = {};
      try { data = JSON.parse(body); } catch (e) { /* ignore */ }

      if (req.url === '/api/start') {
        startTest(data);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end('{"ok":true}');
        return;
      }

      if (req.url === '/api/stop') {
        stopPort();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end('{"ok":true}');
        return;
      }

      if (req.url === '/api/save') {
        writeConfig(data, function (err) {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: !err, error: err ? err.message : null }));
        });
        return;
      }

      if (req.url === '/api/clear') {
        logs = [];
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end('{"ok":true}');
        return;
      }

      res.writeHead(404);
      res.end('Not found');
    });
    return;
  }

  res.writeHead(404);
  res.end('Not found');
});

server.listen(HTTP_PORT, function () {
  console.log('Serial Tester running at http://localhost:' + HTTP_PORT);
  console.log('Open browser and go to http://localhost:' + HTTP_PORT);
});
