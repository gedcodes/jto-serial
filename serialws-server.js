import SerialPort from "serialport";
import WebSocket, { WebSocketServer } from 'ws';
const timer = ms => new Promise(res => setTimeout(res, ms))
// Websocket
const wss = new WebSocketServer({ port: 8300 });
var clients = [];

wss.on('connection', function connection(ws, req) {
  // const ip = req.socket.remoteAddress;
  // var connection = ws.accept(null, ws.origin); 
  // console.log(wss.clients.length);

  ws.on('message', function message(data, isBinary) {
    // console.log(data);

    wss.clients.forEach(function each(client) {
      if (client.readyState === WebSocket.OPEN) {
        onReceive(data);
      }
    });
  });
});

function onReceive(msg) {
  console.log("ws msg:" + msg);
  serialPort.write(msg);
  wss.clients.forEach(function each(client) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(msg);
      // client.close();
    }
  });
}

function onSerial(msg) {
  var regex = /(\d+)(?=[^\d]+$)/g;
  var res = msg.replace(/\s/g, '');// .toString();
  console.log("Weight Scale Data : ", res, " | Berat Timbang : " + res.match(regex));
  // for (var i = 0; i < clients.length; i++)
  //   clients[i].sendUTF(msg);
  wss.clients.forEach(async function each(client) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify({ "berat_timbangs": res.match(regex)[0] }));
      // client.close();
    }
    await timer(500);
  });
}

// Serial port
// var SerialPort = require("serialport").SerialPort
var portName = 'COM2';
var buffer = "";

var serialPort = new SerialPort(portName, {
  baudRate: 9600,
  // defaults for Arduino serial communication
  dataBits: 8,
  parity: 'none',
  stopBits: 1,
  flowControl: false
});

serialPort.on("open", function () {
  console.log('open serial communication');
  // Listens to incoming data
  serialPort.on('data', function (data) {

    buffer += new String(data);
    var lines = buffer.split("\n");
    while (lines.length > 1)
      onSerial(lines.shift());
    buffer = lines.join("\n");
    // console.log(buffer);
  });
});  