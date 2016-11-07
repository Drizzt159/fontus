/*jslint node:true, vars:true, bitwise:true, unparam:true */
/*jshint unused:false */


// Set up CE and CSN pins for the NRF24L01
// These will be directly controlled by software NOT the SPI hardware
var CEPin;
var CSNPin;
var m;
var SPI;
// Global variable that is updated during each SPI transaction
var NRFStatus;

//0x65646f4e31LL, 0x65646f4e32LL
var PAYLOAD_LENGTH=32;
var SOURCE_ADDRESS=([0x31, 0x4e, 0x6f, 0x64, 0x65]);
var DESTINATION_ADDRESS=([0x32, 0x4e, 0x6f, 0x64, 0x65]);

function delay(howlong)
{
	howlong = howlong / 2; // yields approx 1us timebase
	while(howlong > 0)
	{
		howlong = howlong -1 ;
	}
}

function transferSPI(data)
{		
	return SPI.writeByte(data);
}


module.exports = {
    
// NRF Functions follow
NRFinit:  function(mraa, spi, ce, csn)
{		
    m = mraa;
    SPI = spi;
    CEPin = new m.Gpio(ce);
    CSNPin = new m.Gpio(csn);
    
    CEPin.dir(m.DIR_OUT);
    CSNPin.dir(m.DIR_OUT);
    CEPin.write(0);
    CSNPin.write(1);
    
	module.exports.NRFWriteRegister(0,0);			// Clear out config
	module.exports.NRFWriteRegister(1,3);			// enable auto ack in P0 and P1
//	module.exports.NRFWriteRegister(1,0x3f);			// enable auto ack in P0 and P1
	module.exports.NRFWriteRegister(4,0x24);		// 750us between retries, 4 retries
	module.exports.NRFWriteRegister(2,3);			// enable data pipe 0 and 1
	module.exports.NRFWriteRegister(3,3);			// 5 byte addressing
//	module.exports.NRFWriteRegister(0x05,5); 		// select channel 5
	module.exports.NRFWriteRegister(0x05,0x4c); 		// select channel 77
	module.exports.NRFWriteRegister(0x06,0x06); 	// select 1Mbps, maximum power
	module.exports.NRFWriteRegister(0x07,0x70); 	// clear status flags
	module.exports.NRFWriteRegister(0x11,0);		// Auto ack in pipe 0
	module.exports.NRFWriteRegister(0x12,PAYLOAD_LENGTH);	// set payload length
	module.exports.NRFWriteCE(1);
	module.exports.NRFEnableRXMode();				// start listening
    
    module.exports.NRFSetRXAddress0(5,DESTINATION_ADDRESS); // set auto ack address = destination
    module.exports.NRFSetTXAddress(5,DESTINATION_ADDRESS);	 // set destination address
    module.exports.NRFSetRXAddress1(5,SOURCE_ADDRESS);		 // set source address
    module.exports.NRFFlushTX();
    module.exports.NRFFlushRX();
    module.exports.NRFEnableRXMode();
    module.exports.NRFWriteCE(1);
},
    
NRFWriteCE: function (Value)
{	
	if (Value)
		CEPin.write(1);
	else
		CEPin.write(0);
		
},
    
NRFWriteCSN: function (Value)
{
	if (Value ) 
		CSNPin.write(1);
	else
		CSNPin.write(0);
},

NRFReadRegister: function (RegNum)
{
	var ReturnValue=0;
	module.exports.NRFWriteCSN(0);	
	if (RegNum < 0x20)
	{
		NRFStatus = transferSPI(RegNum); // update status after CSN goes low
		ReturnValue = transferSPI(0xff); // Send dummy byte to generate clocks		
	}
	else
	{
		ReturnValue = -1;
	}
	module.exports.NRFWriteCSN(1);		
	return ReturnValue;
},

NRFWriteRegister: function (RegNum, Value)
{
	var ReturnValue=0;
	module.exports.NRFWriteCSN(0);	
	if (RegNum < 0x20)
	{		
		NRFStatus = transferSPI(0x20+RegNum); // update status after CSN goes low				
		ReturnValue = transferSPI(Value);	  // Write byte to target
	}
	else
	{
		ReturnValue = -1;
	}
	module.exports.NRFWriteCSN(1);
	return ReturnValue;
},
    
NRFFlushTX:function ()
{
	module.exports.NRFWriteCSN(0);	
	NRFStatus = transferSPI(0xe1); // Send Flush TX command
	module.exports.NRFWriteCSN(1);
},
    
NRFFlushRX: function ()
{
	module.exports.NRFWriteCSN(0);	
	NRFStatus = transferSPI(0xe2); // Send Flush RX command
	module.exports.NRFWriteCSN(1);
},

NRFSetRXAddress0: function (AddressLength, Address)
{
	var index;
	switch (AddressLength) {
		case 3 : {
			module.exports.NRFWriteRegister(3,1); // 3 byte address length			
			break;
		}
		case 4 : {
			module.exports.NRFWriteRegister(3,2); // 4 byte address length
			break;
		}
		case 5 : {
			module.exports.NRFWriteRegister(3,3); // 5 byte address length
			break;
		}
		default: {
			return -1; // invalid address length
		}
	}
	module.exports.NRFWriteCSN(0);
	NRFStatus = transferSPI(0x20+0x0a); // start write to RX_P0_Pipe address
	for (index = 0; index < AddressLength; index++)
	{
		NRFStatus = transferSPI(Address[index]);
	}
	module.exports.NRFWriteCSN(1);
},
    
NRFSetRXAddress1: function (AddressLength, Address)
{
	var index;
	switch (AddressLength) {
		case 3 : {
			module.exports.NRFWriteRegister(3,1); // 3 byte address length			
			break;
		}
		case 4 : {
			module.exports.NRFWriteRegister(3,2); // 4 byte address length
			break;
		}
		case 5 : {
			module.exports.NRFWriteRegister(3,3); // 5 byte address length
			break;
		}
		default: {
			return -1; // invalid address length
		}
	}
	module.exports.NRFWriteCSN(0);
	NRFStatus = transferSPI(0x20+0x0b); // start write to RX_P1_Pipe address
	for (index = 0; index < AddressLength; index++)
	{
		NRFStatus = transferSPI(Address[index]);
	}
	module.exports.NRFWriteCSN(1);
},
    
NRFGetRXAddress: function ( MaxAddressLength,  Address)
{
	var index;
	var actual_length;
	actual_length = module.exports.NRFReadRegister(3);
	actual_length = actual_length + 2;
	if (actual_length > MaxAddressLength)
		return -1;
	module.exports.NRFWriteCSN(0);
	NRFStatus = transferSPI(0x0a); // start read from RX_P0_Pipe address
	for (index = 0; index < actual_length; index++)
	{
		Address[index] = transferSPI(0xff);
	}
	module.exports.NRFWriteCSN(1);
	return(0);
},
    
NRFSetTXAddress: function (AddressLength, Address)
{
	var index;
	switch (AddressLength) {
		case 3 : {
			module.exports.NRFWriteRegister(3,1); // 3 byte address length			
			break;
		}
		case 4 : {
			module.exports.NRFWriteRegister(3,2); // 4 byte address length
			break;
		}
		case 5 : {
			module.exports.NRFWriteRegister(3,3); // 5 byte address length
			break;
		}
		default: {
			return -1; // invalid address length
		}
	}
	module.exports.NRFWriteCSN(0);
	NRFStatus = transferSPI(0x20+0x10); // start write to TX address
	for (index = 0; index < AddressLength; index++)
	{
		transferSPI(Address[index]);
	}
	module.exports.NRFWriteCSN(1);
	return(0);
},

NRFGetTXAddress: function (MaxAddressLength, Address)
{
	var index;
	var actual_length;
	actual_length = module.exports.NRFReadRegister(3);
	actual_length = actual_length + 2;
	if (actual_length > MaxAddressLength)
		return -1;
	module.exports.NRFWriteCSN(0);
	NRFStatus = transferSPI(0x10); // start read from TX address
	for (index = 0; index < actual_length; index++)
	{
		Address[index] = transferSPI(0xff);
	}
	module.exports.NRFWriteCSN(1);
	return(0);
},
    
NRFEnableTXMode: function ()
{
//	NRFWriteRegister(0,0x0a); // enable CRC, power up
	module.exports.NRFWriteRegister(0,0x0e); // enable CRC 16 bit, power up
},
    
NRFEnableRXMode: function ()
{
//	NRFWriteRegister(0,0x0b); // enable CRC, power up, RX mode
	module.exports.NRFWriteRegister(0,0x0f); // enable CRC 16 bit, power up, RX mode
},
    
NRFWriteData: function (Length, Data)
{
	var index;
	if (Length > PAYLOAD_LENGTH)
		return -1; // too long
	module.exports.NRFWriteCE(0);
	module.exports.NRFWriteRegister(0x07,0x70); // clear RX_DR,TX_DS,MAX_RT bits
	module.exports.NRFEnableTXMode();
	module.exports.NRFWriteCSN(0);
	NRFStatus = transferSPI(0xa0); // start write to TX buffer
	for (index = 0; index < Length; index++)
	{
		transferSPI(Data[index]);
	}
    // Read remaing payload to clear.
    while (index < PAYLOAD_LENGTH)
	{
		transferSPI(0xff);
        index++;
	}
	module.exports.NRFWriteCSN(1);
	module.exports.NRFWriteCE(1);	
	console.log("Sending..");
	module.exports.NRFEnableRXMode();
},
    
NRFReadData: function (MaxLength,Data)
{ // data is assumeed to be in data pipe 1
	var available_bytes;
	var index;
	var Length;
	available_bytes = module.exports.NRFReadRegister(0x12); // find out how many bytes are available in P1
	if (available_bytes === 0)
		return 0;
    //console.log("bytes available: " + available_bytes.toString());
	module.exports.NRFWriteCSN(0);
	NRFStatus = transferSPI(0x61); // start read from RX buffer
	if (available_bytes > MaxLength)
		Length = MaxLength;
	else
		Length = available_bytes;
	for (index = 0; index < Length; index++)
	{
		Data[index]=transferSPI(0xff);
	}
    // Read remaing payload to clear.
    while (index < available_bytes)
	{
		transferSPI(0xff);
        index++;
	}
	module.exports.NRFWriteCSN(1);
	return Length;
},
    
printRegisters: function ()
{
	var regnum;
	for (regnum = 0;regnum < 0x20; regnum++)
	{		
		var hexstring = module.exports.NRFReadRegister(regnum).toString(16); 
		console.log(regnum.toString(16) + " : " + hexstring);
		//console.log(regNames[regnum] + " : " + hexstring);
	}
}
    
};

