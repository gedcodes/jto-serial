const express = require('express');
const app = express();
const bodyParser = require('body-parser');
const cors = require('cors');

app.use(express.static(__dirname));

app.use(cors());
app.set('trust proxy', true);
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

const SerialPort = require('serialport');
const Readline = require('@serialport/parser-readline');

app.get('/loadcell', async(req, res, next) => {
    const port = new SerialPort('COM3', { baudRate: 9600, autoOpen: false, });
    const parser = port.pipe(new Readline({ delimiter: '\n' }));
    var resdata;

    // const serialdata = () => {
    let serialdata = new Promise(function(resolve, reject) {
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
                var myRegEx = /Gross\s+(\d+)\s+kg/gi;
                // console.log(data)
                // Get an array containing the first capturing group for every match
                var matches = getMatches(data, myRegEx, 1);
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