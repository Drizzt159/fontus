/*jslint node:true, vars:true, bitwise:true, unparam:true */
/*jshint unused:true */

/*
A simple node.js application intended to blink the onboard LED on the Intel based development boards such as the Intel(R) Galileo and Edison with Arduino breakout board.

MRAA - Low Level Skeleton Library for Communication on GNU/Linux platforms
Library in C/C++ to interface with Galileo & other Intel platforms, in a structured and sane API with port nanmes/numbering that match boards & with bindings to javascript & python.

Steps for installing MRAA & UPM Library on Intel IoT Platform with IoTDevKit Linux* image
Using a ssh client: 
1. echo "src maa-upm http://iotdk.intel.com/repos/1.1/intelgalactic" > /etc/opkg/intel-iotdk.conf
2. opkg update
3. opkg upgrade

Article: https://software.intel.com/en-us/html5/articles/intel-xdk-iot-edition-nodejs-templates
*/

var mraa = require('mraa'); //require mraa
console.log('MRAA Version: ' + mraa.getVersion()); //write the mraa version to the Intel XDK console
var dot = 150;
var dash = dot * 3;
var cspace = dot *3;
var espace = dot;
var wspace = dot * 7;
var buf = [dot, espace, dot, espace, dot, cspace, dash, espace, dash, espace, dash, cspace, dot, espace, dot, espace, dot, wspace];
var idx = 0;

//var myOnboardLed = new mraa.Gpio(3, false, true); //LED hooked up to digital pin (or built in pin on Galileo Gen1)
var myOnboardLed = new mraa.Gpio(13); //LED hooked up to digital pin 13 (or built in pin on Intel Galileo Gen2 as well as Intel Edison)
myOnboardLed.dir(mraa.DIR_OUT); //set the gpio direction to output
var ledState = false; //Boolean to hold the state of Led

myOnboardLed.write(0); // turn off to start with
periodicActivity(); //call the periodicActivity function

function periodicActivity()
{
    /*
    var delayPeriod = buf[idx++];
    if (delayPeriod == 0) {
        idx = 0;
        setTimeout(periodicActivity, 1);
    } else {
        ledState = !ledState; //invert the ledState
        myOnboardLed.write(ledState?1:0); //if ledState is true then write a '1' (high) otherwise write a '0' (low)
        setTimeout(periodicActivity, delayPeriod); //call the indicated function after 1 second (1000 milliseconds)
    }
    */
    if (idx < buf.length) {
        var delayPeriod = buf[idx++];
        ledState = !ledState; //invert the ledState
        myOnboardLed.write(ledState?1:0); //if ledState is true then write a '1' (high) otherwise write a '0' (low)
        setTimeout(periodicActivity, delayPeriod); //call the indicated function after 1 second (1000 milliseconds)
    } else {
        idx = 0;
        setTimeout(periodicActivity, 1);
    }
}
