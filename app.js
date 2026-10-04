import SerialPort from "serialport";
import WebSocket, { WebSocketServer } from 'ws';
import config from "./config.js";

const MAX_BUFFER_SIZE = 4096;
const RECONNECT_DELAY_MS = 3000;
const SERIAL_ENCODING = 'latin1';

var portName = config.portName;
var buffer = "";
var regex = config.regexParser;
var typeloadcell = config.typeLoadcell;
var serialPort = null;
var reconnecting = false;

// --- WebSocket Server ---

const wss = new WebSocketServer({ port: config.wsPort });

wss.on('connection', function connection(ws) {
  ws.on('message', function message(data) {
    onReceive(data);
  });

  ws.on('error', function (err) {
    console.error('WebSocket client error:', err.message);
  });
});

wss.on('error', function (err) {
  console.error('WebSocket server error:', err.message);
});

function broadcastToClients(data) {
  wss.clients.forEach(function each(client) {
    if (client.readyState === WebSocket.OPEN) {
      try {
        client.send(data);
      } catch (err) {
        console.error('WebSocket send error:', err.message);
      }
    }
  });
}

function onReceive(msg) {
  console.log("ws msg:" + msg);
  if (serialPort && serialPort.isOpen) {
    serialPort.write(msg, function (err) {
      if (err) {
        console.error('Serial write error:', err.message);
      }
    });
  }
  broadcastToClients(msg);
}

// --- Data Parsing ---

function safeMatch(str, pattern) {
  var re = new RegExp(pattern.source, pattern.flags);
  return str.match(re);
}

function getMatches(string, pattern, index) {
  index || (index = 1);
  var re = new RegExp(pattern.source, pattern.flags);
  var matches = [];
  var match;
  while (match = re.exec(string)) {
    matches.push(match[index]);
  }
  return matches;
}

function kubota(msg) {
  var res = msg.replace(/\s/g, '');
  var matched = safeMatch(res, regex);
  if (!matched || matched.length === 0) return;
  var weight = matched[matched.length - 1];
  console.log("Weight Scale Data : ", res, " | Berat Timbang : " + weight);
  broadcastToClients(JSON.stringify({ "berat_timbangs": weight }));
}

function minebea(msg) {
  var res = msg.replace(/1cH|1bH|1sH|1aH|1rH/gi, '');
  var matched = safeMatch(res, regex);
  if (!matched || matched.length === 0) return;
  var weight = matched[matched.length - 1];
  console.log("Weight Scale Data : ", res, " | Berat Timbang : " + weight);
  broadcastToClients(JSON.stringify({ "berat_timbangs": weight }));
}

function xk2190(msg) {
  var res = msg.replace(/\s/g, '');
  var validFrame = /[+-](\d{6})[Kk][Gg]/g;
  var match;
  while (match = validFrame.exec(res)) {
    var weight = match[1];
    console.log("Weight Scale Data :  " + match[0] + "  | Berat Timbang : " + weight);
    broadcastToClients(JSON.stringify({ "berat_timbangs": weight }));
  }
}

function onSerial(msg) {
  if (!msg || msg.trim().length === 0) return;

  if (typeloadcell == 'AWTZM510') {
    var matches = getMatches(msg, regex, 1);
    if (matches[0] != undefined) {
      console.log("Weight Scale Data : ", typeloadcell, " | Berat Timbang : " + matches[0]);
      broadcastToClients(JSON.stringify({ "berat_timbangs": matches[0] }));
    }
  } else if (typeloadcell == 'MINEBEA') {
    minebea(msg);
  } else if (typeloadcell == 'XK3190') {
    xk2190(msg);
  } else {
    kubota(msg);
  }
}

// --- Serial Port ---

function processGST9600Buffer() {
  var framePattern = /ST,GS,[+-]\s*\d+[Kk][Gg]/g;
  var weightPattern = /[+-]\s*(\d+)/;
  var match;
  var lastMatchEnd = 0;
  var found = false;

  while (match = framePattern.exec(buffer)) {
    var frame = match[0].replace(/\s/g, '');
    var wMatch = frame.match(weightPattern);
    if (!wMatch) continue;
    var digits = wMatch[1];
    console.log("Weight Scale Data : ", match[0].replace(/\s/g, ''), " | Berat Timbang : " + digits);
    broadcastToClients(JSON.stringify({ "berat_timbangs": digits }));
    lastMatchEnd = framePattern.lastIndex;
    found = true;
  }

  if (found) {
    buffer = buffer.substring(lastMatchEnd);
  }

  if (buffer.length > 256) {
    buffer = buffer.substring(buffer.length - 64);
  }
}

function processDelimiterBuffer(delimiter) {
  var lines = buffer.split(delimiter);
  if (lines.length <= 1) {
    var frameEnd = buffer.lastIndexOf("Kg");
    if (frameEnd < 0) frameEnd = buffer.lastIndexOf("kg");
    if (frameEnd >= 0) {
      var toProcess = buffer.substring(0, frameEnd + 2);
      buffer = buffer.substring(frameEnd + 2);
      try { onSerial(toProcess); } catch (err) {
        console.error('Error processing serial data:', err.message);
      }
    }
    return;
  }

  var remaining = lines.pop();
  buffer = remaining || "";

  for (var i = 0; i < lines.length; i++) {
    if (lines[i].length > 0) {
      try { onSerial(lines[i]); } catch (err) {
        console.error('Error processing serial data:', err.message);
      }
    }
  }
}

function createSerialPort() {
  serialPort = new SerialPort(portName, {
    baudRate: config.baudRate,
    dataBits: config.dataBits,
    parity: config.parity,
    stopBits: config.stopBits,
    flowControl: config.flowControl
  });

  serialPort.on('error', function (err) {
    console.error('Serial port error:', err.message);
    scheduleReconnect();
  });

  serialPort.on('close', function () {
    console.log('Serial port closed');
    if (!reconnecting) {
      scheduleReconnect();
    }
  });

  serialPort.on('open', function () {
    console.log('open serial communication');
    reconnecting = false;
    buffer = "";

    serialPort.on('data', function (data) {
      buffer += data.toString(SERIAL_ENCODING);

      if (buffer.length > MAX_BUFFER_SIZE) {
        console.warn('Buffer overflow, discarding old data');
        buffer = buffer.slice(-MAX_BUFFER_SIZE / 2);
      }

      if (typeloadcell == 'kubota') {
        processDelimiterBuffer("\n");
      } else {
        processDelimiterBuffer(/[\r\n\x03]+/);
      }
    });
  });
}

function scheduleReconnect() {
  if (reconnecting) return;
  reconnecting = true;
  buffer = "";

  if (serialPort) {
    serialPort.removeAllListeners();
    if (serialPort.isOpen) {
      try { serialPort.close(); } catch (e) { /* ignore */ }
    }
  }

  console.log('Reconnecting serial port in ' + (RECONNECT_DELAY_MS / 1000) + 's...');
  setTimeout(function () {
    reconnecting = false;
    createSerialPort();
  }, RECONNECT_DELAY_MS);
}

// --- Process Error Handlers ---

process.on('uncaughtException', function (err) {
  console.error('Uncaught exception:', err.message);
});

process.on('unhandledRejection', function (reason) {
  console.error('Unhandled rejection:', reason);
});

process.on('SIGINT', function () {
  console.log('Shutting down...');
  if (serialPort && serialPort.isOpen) {
    serialPort.close();
  }
  wss.close();
  process.exit(0);
});

// --- Start ---

createSerialPort();
