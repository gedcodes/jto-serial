import SerialPort from "serialport";
const timer = ms => new Promise(res => setTimeout(res, ms))
var port = "COM1";
var message = "Hakuna Matata";

var serialPort = new SerialPort(port, {
  baudRate: 9600
});
const resp = '☻U000G+     40.kg♥';
for (var i = 1; i < 30000; i = i + 100) {
  console.log(resp);

  serialPort.write(resp + "\n", async function (err) {
    if (err) {
      return console.log("Error on write: ", err.message);
    }



    // if (i > 5000) {
    //   i = i - 100;
    //   await timer(5000);
    //   i = i - 100;
    // }
    // console.log("Message sent successfully");
  });
  await timer(500); // then the created Promise can be awaited
}
