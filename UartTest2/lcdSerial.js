/*jslint node:true, vars:true, bitwise:true, unparam:true */
/*jshint unused:false */

var uart;

function sleep(delay) {
  delay += new Date().getTime();
  while (new Date() < (delay + 1)) { }
}

var InitAckDone = 0xaa;

var CharHeader = new Buffer([0xfe]);
var CursorHeader = new Buffer([0xff]);
var ControlHeader = new Buffer([0x9f]);
var PowerOff = new Buffer([0x82]); 
var PowerOn = new Buffer([0x83]); 
var InitAck = new Buffer([0xa5]);
var ReturnHome = new Buffer([0x61]); 
var ClearDisplay = new Buffer([0x65]); 
var CursorOff = new Buffer([0x66]); 
var CursorOn = new Buffer([0x67]); 
var DisplayOff = new Buffer([0x63]); 
var DisplayOn = new Buffer([0x64]); 
var BacklightOff = new Buffer([0x80]);
var BacklightOn = new Buffer([0x81]);

module.exports = {
    // Returns true on success
    init: function(u) {
        uart = u;
        var tries = 3;
        var done = false;
        
        while ((done === false) && (tries > 0)) {
            console.log("try count " + tries.toString());
            sleep(2);
            module.exports.powerOff();
            module.exports.powerOn();

            u.write(InitAck);
            sleep(1);

            var now = new Date().getTime();
            // Wait no more than one second for an ACK.
            while ((done === false) && ((now + 1000) > new Date().getTime())) {
                if (u.dataAvailable()) {
                    var inBuffer = u.read(1);
                    if (inBuffer[0] == InitAckDone) {
                        done = true;
                        console.log("got it");
                    }
                }
            }
            console.log("found ack or timeout " + done.toString());
            if (done === false) {
                console.log("trying again");
                tries--;
            }
        }
        sleep(2);
        
        console.log("returning " + done.toString());
        return done;
    },
    
    powerOn: function() {
        uart.write(ControlHeader);
        uart.write(PowerOn);
        sleep(1);
    },
    
    powerOff: function() {
        uart.write(ControlHeader);
        uart.write(PowerOff);
        sleep(1);
    },

    returnHome: function() {
        uart.write(ControlHeader);
        uart.write(ReturnHome);
        sleep(1);
    },
    
    clearDisplay: function() {
        uart.write(ControlHeader);
        uart.write(ClearDisplay);
        sleep(1);
    },
    
    cursorOn: function() {
        uart.write(ControlHeader);
        uart.write(CursorOn);
        sleep(1);
    },
    
    cursorOff: function() {
        uart.write(ControlHeader);
        uart.write(CursorOff);
        sleep(1);
    },
    
    displayOn: function() {
        uart.write(ControlHeader);
        uart.write(DisplayOn);
        sleep(1);
    },
    
    displayOff: function() {
        uart.write(ControlHeader);
        uart.write(DisplayOff);
        sleep(1);
    },
    
    backlightOn: function() {
        uart.write(ControlHeader);
        uart.write(BacklightOn);
        sleep(1);
    },
    
    backlightOff: function() {
        uart.write(ControlHeader);
        uart.write(BacklightOff);
        sleep(1);
    },
    
    writeStr: function(str) {
        uart.write(CharHeader);
        uart.writeStr(str);
    },
    
    setCursor: function(row, column) {
        uart.write(ControlHeader);
        uart.write(CursorHeader);
        uart.write(new Buffer([column, row]));
    }
};
