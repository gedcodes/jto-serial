const express = require('express');
const app = express();
const bodyParser = require('body-parser');
const cors = require('cors');
const config = require('./config');
app.use(express.static(__dirname));

app.use(cors());
app.set('trust proxy', true);
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

const SerialPort = require('serialport');
const Readline = require('@serialport/parser-readline');

app.get('/loadcell', async(req, res, next) => {
    const port = new SerialPort(config.com, { 
        baudRate: config.baudrate, 
        autoOpen: false, 
        parser: new SerialPort.parsers.Readline("\n"),
        dataBits: config.dataBits,
        parity: config.parity,
        stopBits: config.stopBits,
        flowControl: false
    });
    const parser = port.pipe(new Readline({ delimiter: '\n' }));
    var resdata;

    // const serialdata = () => {
    let serialdata = new Promise(function(resolve, reject) {
        const resp = '☻U000G+     40.kg♥';
        console.lo
        port.open(function(err){
            if (err) {
                console.log("Port open error: ", err);
            }
            else {
                console.log("Port opened!");
            }
        })

        port.on('open', function() {
            parser.on('data', data =>{
                console.log(data.toString());
                // var remove_special_char = data.replace(/[^\w\s]/gi, '');
                // console.log(remove_special_char.replace(/S000G\s/g,"").replace(/^\s+|\s+$/gi,''));//data.toString().replace(/[&\/\\#,+()$~%.'":*?<>{}]/g,'').replace(/[^\w\s]\S000G/gi, ''));
                // //

                // var myRegEx = /S000G\s+kg/gi;
                var myRegEx = /S000G+\s+(\d+)\s+kg+[^\w\s]/gi;
                console.log(data)
                // Get an array containing the first capturing group for every match
                var matches = getMatches(data, myRegEx, 1);
                console.log(matches);
                //☻S000G+      0.kg♥
                // ☻U000G+     40.kg♥
                /*
                if (matches[0] != undefined) {
                    //console.log(matches[0]);
                    if (matches[0] != undefined) {
                        resolve(matches[0]);
                    
                        port.close();
                    } else {
                        reject(matches[0]);
                    }
                } else {
                    reject(matches[0]);
                }
                */
            });
        });
    });
    serialdata.then((data)=>{
        //console.log(data);
        res.send({
            success: true,
            data: Number(data)
        });

    })
});

function isANumber( n ) {
    var numStr = /^-?(\d+\.?\d*)$|(\d*\.?\d+)$/;
    return numStr.test( n.toString() );
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


app.listen(8300, () => console.log("JTO Serial Port Listening to port 8300"))