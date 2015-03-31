var serialport = require('serialport');
var SerialPort = serialport.SerialPort;
var readData;

comPort = new SerialPort("COM8", { baudrate:9600 }, false);

comPort.open(function(err) {
		if (err) {
			console.log("not open");
			return;
		}

		comPort.on("data", function(data){
			//log(comPortName + "-> Data: " + data, 3);
			console.log("Data recieved: " + data);
		});

		comPort.on("close", function(err) {
			console.log("On close");
		});

		var sendPing = setInterval(function() {
			comPort.write("p");
		}, 1000);


		var sendPing = setInterval(function() {
			comPort.write("h");
		}, 5000);
	});
