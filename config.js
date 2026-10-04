export default {
    wsPort: 8300,
    portName: 'COM5',
    baudRate: 9600,
    dataBits: 7,
    parity: 'even',
    stopBits: 1,
    flowControl: false,
    typeLoadcell: 'GST9600',
    // typeLoadcell: 'MKDi01P',
    // regexParser: /Gross\s+(\d+)(?=[^\d]+$)/g
    regexParser: /(\d+)(?=[^\d]+$)/g
    // regexParser: /(\d+)\w+/g
    // regexParser: /\d{6}/g
};
