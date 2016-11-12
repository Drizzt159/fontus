/*
* Copyright (c) 2015 - 2016 Intel Corporation.
*
* Permission is hereby granted, free of charge, to any person obtaining
* a copy of this software and associated documentation files (the
* "Software"), to deal in the Software without restriction, including
* without limitation the rights to use, copy, modify, merge, publish,
* distribute, sublicense, and/or sell copies of the Software, and to
* permit persons to whom the Software is furnished to do so, subject to
* the following conditions:
*
* The above copyright notice and this permission notice shall be
* included in all copies or substantial portions of the Software.
*
* THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
* EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
* MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
* NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE
* LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION
* OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION
* WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
*/

"use strict";

// The program is using the Node.js built-in `fs` module
// to load the config.json and any other files needed
var fs = require("fs");

// The program is using the Node.js built-in `path` module to find
// the file path to needed files on disk
var path = require("path");

// Load configuration data from `config.json` file. Edit this file
// to change to correct values for your configuration
var config = JSON.parse(
  fs.readFileSync(path.join(__dirname, "config.json"))
);

var reportIndex = 0;
var dataDictionary = {};

var datastore = require("./datastore");
var mqtt = require("./mqtt");
var request = require("request");

// The program is using the `later` module
// to handle scheduling of recurring tasks
var later = require("later");

var log_file = null;

// The program is using the `twilio` module
// to make the remote calls to Twilio service
// to send SMS alerts
var twilio;
if (config.TWILIO_ACCT_SID && config.TWILIO_AUTH_TOKEN) {
  twilio = require("twilio")(config.TWILIO_ACCT_SID,
                                 config.TWILIO_AUTH_TOKEN);
}

var m = require("mraa");
console.log("MRAA version: " + m.getVersion());

// configure SPI for 1MHz operation
var SPI = new m.Spi(0);
SPI.frequency(1000000);

// Create the UART object.
var uart = new m.Uart(0);

// Load the radio package for remote sensoring.
var radio = require("./nrf2401");

// Load the serial LCD package.
var lcdSerial = require("./lcdSerial");

// Used to store the schedule for turning on/off the
// watering system, as well as store moisture data
var SCHEDULE = {},
    MOISTURE = [],
    FLOW = [],
    intervals = [],
    smsSent = false;

// Initialize the hardware for whichever kit we are using
var board;
if (config.kit) {
  board = require("./" + config.kit + ".js");
} else {
  board = require("./grove.js");
}
board.init(config);

var ipAddress = "";
var networkInterfaces = require("os").networkInterfaces();

function logDebug(err) {
    try {
        if (log_file != null) {
            log_file.write(err);
        }
    } catch(err) {
        console.log("Error logging: " + err);
    }
}

function setIpAddress() {
    try {
        if (networkInterfaces.hasOwnProperty("wlp1s0")) {
            for (var n = 0; n < networkInterfaces.wlp1s0.length; n++) {
                if (networkInterfaces.wlp1s0[n].family === "IPv4") {
                    ipAddress = networkInterfaces.wlp1s0[n].address;
                }
            }
        }
        if (networkInterfaces.hasOwnProperty("enp0s20f6")) {
            if (ipAddress.length === 0) {
                for (var k = 0; k < networkInterfaces.enp0s20f6.length; k++) {
                    if (networkInterfaces.enp0s20f6[k].family === "IPv4") {
                        ipAddress = networkInterfaces.enp0s20f6[k].address;
                    }
                }
            }
        }
    } catch(err) {
        console.log(err);
        logDebug(err);
    }
    console.log(ipAddress);
}

// Display and then store record in the remote datastore/mqtt server
// of each time a watering system event has occurred
function log(event) {
  console.log(event);
  var payload = { value: event + " " + new Date().toISOString() };

  datastore.log(config, payload);
  mqtt.log(config, payload);
}

function turnOn() {
  log("turn on");
  board.turnOn();
}

function turnOff() {
  log("turn off");
  board.turnOff();
}

// Set up 0-23 hour schedules
for (var i = 0; i < 24; i++) {
  SCHEDULE[i] = { on: false, off: false };
}

// Helper function to convert a value to an integer
function toInt(h) { return +h; }

// Generates a later schedule for when the water should be turned on
function onSchedule() {
  function isOn(h) { return SCHEDULE[h].on; }

  return {
    schedules: [ { h: Object.keys(SCHEDULE).filter(isOn).map(toInt) } ]
  };
}

// Generates a later schedule for when the water should be turned off
function offSchedule() {
  function isOff(h) { return SCHEDULE[h].off; }

  return {
    schedules: [ { h: Object.keys(SCHEDULE).filter(isOff).map(toInt) } ]
  };
}

// Send a SMS alert indicating something's wrong
function alert() {
  console.log("Watering system alert");
  if (!config.TWILIO_ACCT_SID || !config.TWILIO_AUTH_TOKEN) {
    return;
  }

  // only send an SMS every 1 minute
  if (smsSent) {
    return;
  }

  var opts = { to: config.NUMBER_TO_SEND_TO,
               from: config.TWILIO_OUTGOING_NUMBER,
               body: "watering system alarm" };

  twilio.sendMessage(opts, function(err, response) {
    if (err) { return console.error("err:", err); }
    console.log("SMS sent", response);
  });

  smsSent = true;
  setTimeout(function() {
    smsSent = false;
  }, 1000 * 60);
}

// Updates the watering schedule, called by web page.
function updateSchedule(data) {
  SCHEDULE = data;
    console.log(data);
  intervals.forEach(function(interval) { interval.clear(); });
  intervals = [
    later.setInterval(turnOn, onSchedule()),
    later.setInterval(turnOff, offSchedule())
  ];
}

// Starts the built-in web server for the web page
// used to set the watering system schedule
function server() {
  var app = require("express")();

  // Helper function to generate the web page's data table
  function elem(data) {
    return [
      "<tr>",
      "<td>",
      data.time,
      "</td>",
      "<td>",
      data.sensor,
      "</td>",
      "<td>",
      data.value,
      "</td>",
      "<td>",
      data.sensorFlow,
      "</td>",
      "<td>",
      data.valueFlow,
      "</td>",
      "</tr>"
    ].join("\n");
  }

  // Serve up the main web page used to configure watering times
  function index(req, res) {
    function serve(err, data) {
      if (err) { return console.error(err); }
      res.send(data.replace("$MOISTUREDATA$", MOISTURE.map(elem).join("\n")));
    }

    fs.readFile(path.join(__dirname, "index.html"), {encoding: "utf-8"}, serve);
  }

  // Set new watering system schedule as submitted
  // by the web page using HTTP PUT
  function update(req, res) {
    updateSchedule(req.body);
    res.send("ok");
  }

  app.use(require("body-parser").json());

  app.get("/", index);
  app.get("/schedule", function(req, res) { res.json({ data: SCHEDULE }); });
  app.put("/schedule", update);
  app.get("/on", function(req, res) { turnOn(); res.send(""); });
  app.get("/off", function(req, res) { turnOff(); res.send(""); });

  app.listen(process.env.PORT || 3000);
}

function pushDataToThingSpeak(value) {
    var requestData = {
      api_key: "CHFOZEUUU1BVFQVN",
      field1: value.toString(),
      field2: (-value).toString()
    };
    
    try {
        request({
            url: "https://api.thingspeak.com/update.json",
            method: "POST",
            json: requestData
            },
            function(err, res, body) {
                // `body` is a js object if request was successful
                //console.log(body);
            if (err) {
                console.log(err);
            } else {
                logDebug("moisture: " + value.toString() + "\n");
            }
        });
    } catch(err) {
        
    }
}

function saveDataMoisture(value, sensor) {
    MOISTURE.push({ value: value, sensor: sensor, time: new Date().toISOString() });

    if (MOISTURE.length > 20) { 
        MOISTURE.shift(); 
    }
}

function saveDataFlow(value, sensor) {
    FLOW.push({ value: value, sensor: sensor, time: new Date().toISOString() });

    if (FLOW.length > 20) { 
        FLOW.shift(); 
    }
}

// Variable to control if checks for checking water sensor
var check = false;
// check the moisture level every 10 seconds
function monitor() {
    setInterval(function() {
        
        var value = board.moistureValue();
        var valueFlow = board.getFlowCount();
        dataDictionary["0"] = value;
        dataDictionary["1"] = valueFlow;
        saveDataMoisture(value, 0);
        saveDataFlow(valueFlow, 8);
        
        pushDataToThingSpeak(value);
        pushDataToThingSpeak(valueFlow);

        log("moisture (" + value + ")");
        if (!check && (value < 50)) {
            turnOn();
            board.startFlow();
            watering(true);
        }
        log("flow (" + board.getFlowCount() + ") millis: (" + board.getMillis() + ") flow rate: (" + board.getFlowRate() + ")");
        if (check && board.getMillis() >= 120000) {
            turnOff();
            board.stopFlow();
            watering(false);
        }
    }, 10 * 1000);
}

function watering(active) {
    check = active;
}

function initLog () {
    try {
        log_file = fs.createWriteStream(
            __dirname + "/debug.log", {flags : "w+"});
    } catch(err) {
        console.log("Failed to open log file: " + err);
    }
}

// This function initializes the radio for remote sensing.
function initRadio() {
    var ce = 8;
    var csn = 10;

    radio.NRFinit(m, SPI, ce, csn);
    console.log("Switching to RX mode");
    radio.printRegisters();
}

function initSerial() {
    var rslt = false;
    try {
        var serialPath = uart.getDevicePath();
        console.log(serialPath);
    
        rslt = lcdSerial.init(uart);
    } catch (err) {
        console.log(err);
    }
    
    if (rslt === true) {
        console.log("lcdSerial inited");
    } else {
        console.log("lcdSerial inited failed!");
    }
    
    return rslt;
}

function displayIpAddress() {
    lcdSerial.displayOn();
    lcdSerial.backlightOn();
    lcdSerial.returnHome();

    lcdSerial.setCursor(0, 0);
    lcdSerial.writeStr(ipAddress);
}

function pollRemoteSensor()
{
    try {
        //radio.printRegisters();
        //console.log("status: " + radio.NRFReadRegister(0x7).toString(16));
        //console.log("fifo: " + radio.NRFReadRegister(0x17).toString(16));
        //console.log("cd: " + radio.NRFReadRegister(0x9).toString(16));
        // check to see if there is any received data
        if ((radio.NRFReadRegister(0x7) & 0x40) > 0)
        {
            // Got data!
            var RXData = new Buffer(3);
            radio.NRFReadData(3,RXData);
            var moisture = RXData[1] + (RXData[2] * 256);
            var sensorId = parseInt(RXData[0]);
            dataDictionary[sensorId.toString()] = moisture;
            console.log(RXData[0].toString() + ":" + RXData[1].toString() + ":" + RXData[2].toString());
            var msg = "Sensor #" + sensorId.toString() + ": " + moisture.toString();
//            console.log(msg);
            
            saveData(moisture, sensorId);
            
            // Respond to the transmitter.
            radio.NRFWriteRegister(0x07,0x70); // clear status flags
            var TXData = new Buffer("moist");
            radio.NRFWriteData(5, TXData);
        }
    } catch(err) {
        console.log(err);
    }
	setTimeout(pollRemoteSensor, 5);
}

function lcdReport() {

    var count = Object.keys(dataDictionary).length;
    
    if (reportIndex < count) {
        var key = Object.keys(dataDictionary)[reportIndex];
        var value = dataDictionary[key];
//        console.log(key.toString() + ":" + value.toString());    
        var msg = "Sensor #" + key.toString() + ": " + value.toString();
//        console.log(msg);

        lcdSerial.clearDisplay();
        lcdSerial.setCursor(0, 0);
        lcdSerial.writeStr(ipAddress);
        lcdSerial.setCursor(1, 0);
        lcdSerial.writeStr(msg);
        reportIndex++;
    }

    if (reportIndex === count) {
        reportIndex = 0;
    }
    
    setTimeout(lcdReport, 3000);
}

// The main function calls `server()` to start up
// the built-in web server used to configure the
// watering system's on/off times.
// It also calls the `monitor()` function which monitors
// the moisture data.
function main() {
    var rslt = initSerial();
    initRadio();
    initLog();
    setIpAddress();
    if (rslt === true) {
        displayIpAddress();
    }
    server();
    if (!check) {
        monitor();
    }
    
    board.events.on("alert", function() {
        alert();
    });
    
    pollRemoteSensor();
    lcdReport();
}

main();
