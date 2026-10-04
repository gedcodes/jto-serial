import SerialPort from "serialport";
import WebSocket, { WebSocketServer } from 'ws';
import config from "./config.js";

const timer = ms => new Promise(res => setTimeout(res, ms))
// Websocket
const wss = new WebSocketServer({ port: config.wsPort });
var clients = [];
var portName = config.portName;
var buffer = "";
var regex = config.regexParser;
var typeloadcell = config.typeLoadcell;
var serialPort = new SerialPort(portName, {
  baudRate: config.baudRate,
  dataBits: config.dataBits,
  parity: config.parity,
  stopBits: config.stopBits,
  flowControl: config.flowControl
});

wss.on('connection', function connection(ws, req) {
  ws.on('message', function message(data, isBinary) {
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

function getMatches(string, regex, index) {
    index || (index = 1); // default to the first capturing group
    var matches = [];
    var match;
    while (match = regex.exec(string)) {
      matches.push(match[index]);
    }
    return matches;
}

function kubota(msg) {
  var res = msg.replace(/\s/g, '');// .toString();
  console.log("Weight Scale Data : ", res,  " | Berat Timbang : " + res.match(regex));
  wss.clients.forEach(async function each(client) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify({"berat_timbangs": res.match(regex)}));
      // client.close();
    }
    await timer(500);
  });
}

function onSerial(msg) {
	console.log(msg.toString());
  if (typeloadcell == 'AWTZM510') {
	var matches = getMatches(msg, regex, 1);
	if (matches[0] != undefined) {
		// console.log('Berat Timbang : ', matches[0]);
		console.log("Weight Scale Data : ", typeloadcell,  " | Berat Timbang : " + matches[0]);
		wss.clients.forEach(async function each(client) {
			if (client.readyState === WebSocket.OPEN) {
				
				client.send(JSON.stringify({"berat_timbangs": matches[0]}));
				// client.close();
			}
			await timer(500);
		});
	}
  } else {
	kubota(msg);
  }
  /*
  var res = msg.replace(/Gross\s/g, '');// .toString();
  var myRegEx = /Gross\s+(\d+)\s+kg/gi;
  
	var matches = getMatches(msg, regex, 1);
	if (matches[0] != undefined) {
		console.log('Berat Timbang : ', matches[0]);
		wss.clients.forEach(async function each(client) {
			if (client.readyState === WebSocket.OPEN) {
				
				client.send(JSON.stringify({"berat_timbangs": matches[0]}));
				// client.close();
			}
			await timer(500);
		});
	} // else {
		//console.log('NO DATA');
		//reject(matches[0]);
	// }
  /*
  wss.clients.forEach(async function each(client) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify({"berat_timbangs": res.match(regex)}));
      // client.close();
    }
    await timer(500);
  });
  */
}

serialPort.on("open", function () {
  console.log('open serial communication');
  // Listens to incoming data
  serialPort.on('data', function (data) {
	  // console.log(data);
    buffer += new String(data);
    var lines = buffer.split("\n");
    while (lines.length > 1)
      onSerial(lines.shift());
    buffer = lines.join("\n");
    // console.log(lines.shift());
  });
});  