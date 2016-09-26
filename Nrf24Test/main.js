/*jslint node:true, vars:true, bitwise:true, unparam:true */
/*jshint unused:false */
// NRF24L01+ demo in javascript for the Intel Galileo Gen 2
// Author: Frank Duignan.  
// Updates posted on http://ioprog.com and http://eleceng.dit.ie/frank

/******* Low level setup (configure I/O etc *******/
var m = require('mraa');
console.log('MRAA version: ' + m.getVersion());

// configure SPI for 1MHz operation
var SPI = new m.Spi(0);
SPI.frequency(1000000);

var radio = require('./nrf2401');

/* The main body of the program follows.  
 * The NRF is initialized with correct addresses etc and is periodically
 * polled to see if there is any data available in the RX FIFO
 * If there is data it is read and a reply is sent back
*/
function poll()
{
    //radio.printRegisters();
	//console.log("status: " + radio.NRFReadRegister(0x7).toString(16));
	//console.log("fifo: " + radio.NRFReadRegister(0x17).toString(16));
	//console.log("cd: " + radio.NRFReadRegister(0x9).toString(16));
	// check to see if there is any received data
	if ((radio.NRFReadRegister(0x7) & 0x40) > 0)
	{
		// Got data!
		console.log("Got data");
		var RXData = new Buffer(2);
		radio.NRFReadData(2,RXData);
        var moisture = RXData[0] || (RXData[1] << 8);
		console.log(moisture);
		radio.NRFWriteRegister(0x07,0x70); // clear status flags
		//RXData[1]=~RXData[0];	// send back some 'dummy' data
        var TXData = new Buffer("moist");
		radio.NRFWriteData(5, TXData);
	}
	setTimeout(poll,5);
}
    
var ce = 8;
var csn = 10;

radio.NRFinit(m, SPI, ce, csn);
console.log("Switching to RX mode");
radio.printRegisters();
poll();
