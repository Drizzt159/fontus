/*jslint node:true, vars:true, bitwise:true, unparam:true */
/*jshint unused:false */
// Leave the above lines for propper jshinting

/*
    The UART - Serial sample application distributed within Intel® XDK IoT Edition under the IoT with Node.js Projects project creation option showcases how to find the general-purpose transistor-transistor logic(TTL)-level port, read and write data.

    MRAA - Low Level Skeleton Library for Communication on GNU/Linux platforms
    Library in C/C++ to interface with Galileo & other Intel platforms, in a structured API with port names/numbering that match compatible boards & with bindings to javascript.

    Steps for installing MRAA & UPM Library on Intel IoT Platform with IoTDevKit Linux* image and an active internet connection
    Using a ssh client: 
    1. echo "src maa-upm http://iotdk.intel.com/repos/1.1/intelgalactic" > /etc/opkg/intel-iotdk.conf
    2. opkg update
    3. opkg upgrade

    Article: https://software.intel.com/en-us/node-js-templates-for-intel-xdk-iot-edition

    Review the README.md for more information about getting started with a sensor.
*/


var mraa = require('mraa'); //require mraa
var lcdSerial = require('./lcdSerial');

//var sp = require('serialport');
console.log('MRAA Version: ' + mraa.getVersion()); //print out the mraa version in IoT XDK console

//Intel(R) Edison & Intel(R) Galileo 
var u = new mraa.Uart(0); //Default
//Name:     UART1, the general-purpose TTL-level port (Arduino shield compatibility)
//Location: Pins 0 (RX) and 1 (TX) on the Arduino shield interface headers or the UART slot on the Grove Starter Kit Base Shield
var serialPath = u.getDevicePath(); //Default general purpose port "/dev/ttyMFD1" - Intel(R) Edison; "/dev/ttyS0" - Intel(R) Galileo
console.log(serialPath);

//Name:     “Multi-gadget” or “Firmware Programming” or "Arduino Serial console" or "OTG" port
//Location: USB-micro connector near center of Arduino board.  - Intel(R) Edison
//var serialPath = "/dev/ttyGS0"; 

//Name:     UART2
//Location: USB-micro connector near edge of Arduino board. - Intel(R) Edison
//var serialPath = "/dev/ttyMFD2";

var waterValve = new mraa.Gpio(7);
waterValve.dir(mraa.DIR_OUT);
waterValve.write(0);

function sleep(delay) {
  delay += new Date().getTime();
  while (new Date() < delay) { }
}

//setup access analog input Analog pin #0 (A0)
var analogPin0 = new mraa.Aio(0); 
var analogValue = 0;

var x = u.setBaudRate(9600);

var rslt = lcdSerial.init(u);
if (rslt === true) {
    console.log("inited");
    lcdSerial.displayOn();
    console.log("here1");
    lcdSerial.backlightOn();
    console.log("here2");
    lcdSerial.returnHome();
    console.log("here3");
    //lcdSerial.cursorOn();
    console.log("here4");
    lcdSerial.writeStr("Water on! ");
    sleep(1000);
    console.log("here5");
    lcdSerial.backlightOff();
    console.log("here6");
    //lcdSerial.cursorOff();

    doNothing();
} else {
    console.log("could not init");
}

var test = true;

function doNothing() {
    test = !test;
    if (test) {
        lcdSerial.displayOff();
        waterValve.write(1);
    } else {
        lcdSerial.displayOn();
        waterValve.write(0);
    }
    analogValue = analogPin0.read();
    lcdSerial.setCursor(0, 0);
    var temp = "    " + analogValue.toString();
    lcdSerial.writeStr("Water on! " + temp.substring(temp.length - 4));
    setTimeout(doNothing, 500);
}


