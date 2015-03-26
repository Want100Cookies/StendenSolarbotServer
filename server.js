var express = require("express");
var app = express();

var wPort = 3700;

app.get("/", function(req, res) {
	res.sendfile("./public/index.html");
});

var io = require("socket.io").listen(app.listen(wPort));
console.log("Listening on port " + wPort);


io.sockets.on('connection', function(socket) {
	socket.emit('console', 'Welcome');

	socket.on('ping', function(data) {
		socket.emit('console', 'pong');
		console.log("Socket " + socket.id + " pinged the server.");
	});

	socket.on('initComPorts', function(data) {
		initComPorts();
	});

	socket.on('listActive', function(data) {
		socket.emit('console', sPorts);
	});

	socket.on('getHandshake', function(data) {
		sPorts.forEach(function(robotObject) {
			robotObject.comPort.write("h");
		});
	});

	socket.on('startGame', function(data) {
		sPorts.forEach(function(robotObject) {
			if(robotObject.game == data.value) {
				robotObject.comPort.write("b");
			}
		});
	});

	socket.on('stopGame', function(data) {
		sPorts.forEach(function(robotObject) {
			if(robotObject.game == data.value) {
				robotObject.comPort.write("s");
			}
		});
	});
});

var serialport = require('serialport');
var SerialPort = serialport.SerialPort;
var readData;

var sPorts = new Array();

function initComPorts() {
	serialport.list( function(err, ports) {
		ports.forEach( function(port) {
			sPorts.push({
				comPort: new SerialPort(port.comName, { baudrate:9600, parser: serialport.parsers.readline("\n") }, false),
				robotName: "",
				game: "",
				state: "NOTREADY",
				points: 0
			});
			io.sockets.emit('console', port.comName + "-> available.");
			// console.log(port.comName + " is available.");
		});
		for(var i = 0; i < sPorts.length; i++) {
			io.sockets.emit('console', sPorts[i].comPort.path + "-> setting up");
			// console.log("Trying to set up comport " + sPorts[i].comPort.path);
			setupPortHandler(sPorts[i], i);
		}
	});
}

function setupPortHandler(robotObject, i) {
	var comPort = robotObject.comPort;
	comPort.on("error", function(err) {
		io.sockets.emit('console', comPort.path + "-> " + err);
		// console.log(comPort.path + "-> " + err);
	});

	comPort.open(function(err) {
		if (err) {
			io.sockets.emit('console', comPort.path + "-> " + err);
			// console.log(err);
			sPorts.splice(i, 1);
			return;
		} else {
			io.sockets.emit('console', comPort.path + "-> port open");
			// console.log(comPort.path + "-> port open");
		}

		comPort.on("data", function(data){
			processData(data, robotObject);
		});

		comPort.on("close", function(err) {
			io.sockets.emit('console', comPort.path + "-> " + err);
			io.sockets.emit('console', comPort.path + "-> port closed");
			// console.log(err);
			// console.log(comPort.path + "-> port closed");
			sPorts.splice(i, 1);
		});
	});
}

function processData(data, robotObject) {
	try {
		var json = JSON.parse(data);
		switch(json.COMMAND) {
			case "HANDSHAKE":
				robotObject.robotName = json.NAME;
				robotObject.game = json.GAME;
				io.sockets.emit("game", robotObject.robotName + " has send handshake to play " + robotObject.game);
				break;
			case "STATE":
				robotObject.state = json.VALUE;
				if(robotObject.state == "READY") {
					io.sockets.emit("game", robotObject.robotName + " is " + json.VALUE);
				}
				break;
			case "POINT":
				robotObject.points += json.VALUE;
				io.sockets.emit("game", robotObject.robotName + " has scored a point. Total: " + robotObject.points);
				break;
			default:
				io.sockets.emit('console', robotObject.comPort.path + "-> JSON not valid");
				// console.log(robotObject.comPort.path + "-> JSON not valid");
				break;
		}
	} catch (e) {
		io.sockets.emit('console', robotObject.comPort.path + "-> Error processing data: " + e);
		// console.log(robotObject.comPort.path + "-> Error processing data: " + e);
	}
}

// sp.on('open', function() {
// 	console.log('Serial port opened');
// 	io.sockets.emit('message', 'Serial port opened');
// 	sp.on('data', function(data) {
// 		readData += data.toString();
// 		if (readData.indexOf('{') >= 0 && readData.indexOf('}') >= 0) {
// 			cleanData = "{" + readData.substring(readData.indexOf('{') + 1, readData.indexOf('}')) + "}";
// 		    readData = '';
// 		    io.sockets.emit('message', cleanData);
// 		}
// 	})
// });
