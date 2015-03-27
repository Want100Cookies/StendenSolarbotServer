var express = require("express");
var app = express();

var wPort = 3700;

app.get("/", function(req, res) {
	res.sendfile("./public/index.html");
});


var DBurl = "mongodb://arduino_user:banaan@dbh54.mongolab.com:27547/arduino_server";
var MongoJS = require("mongojs");
var DB = MongoJS.connect(DBurl, ["robots", "log"]);

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
		for(var comPortName in sPorts) {
			sPorts[comPortName].comPort.write("h");
		}
	});

	socket.on('startGame', function(data) {
		for(var comPortName in sPorts) {
			if(sPorts[comPortName].game == data.value) {
				sPorts[comPortName].comPort.write("b");
			}
		}
	});

	socket.on('stopGame', function(data) {
		for(var comPortName in sPorts) {
			if(sPorts[comPortName].game == data.value) {
				sPorts[comPortName].comPort.write("s");
			}
		}
	});
});

var serialport = require('serialport');
var SerialPort = serialport.SerialPort;
var readData;

var sPorts = {};

function initComPorts() {
	serialport.list( function(err, ports) {
		ports.forEach( function(port) {

			sPorts[port.comName] = {
				comPort: new SerialPort(port.comName, { baudrate:9600, parser: serialport.parsers.readline("\n") }, false),
				robotName: "",
				game: "",
				state: "NOTREADY",
				points: 0,
				pingSend: 0,
				pingRecieved: 0
			};
			io.sockets.emit('console', port.comName + "-> available.");

			// console.log(port.comName + " is available.");
		});
		for(var comPort in sPorts) {
			io.sockets.emit('console', comPort + "-> setting up");
			// console.log("Trying to set up comport " + sPorts[i].comPort.path);
			setupPortHandler(sPorts[comPort], comPort);
		}
	});
}

function setupPortHandler(robotObject, comPortName) {
	var comPort = robotObject.comPort;
	comPort.on("error", function(err) {
		io.sockets.emit('console', comPortName + "-> " + err);
		// console.log(comPort.path + "-> " + err);
		sPorts.splice(i, 1);
	});

	comPort.open(function(err) {
		if (err) {
			io.sockets.emit('console', comPortName + "-> " + err);
			// console.log(err);
			delete sPorts[comPortName];
			return;
		} else {
			io.sockets.emit('console', comPortName + "-> port open");
			comPort.write("h");
			comPort.write("s");
		}

		comPort.on("data", function(data){
			processData(data, robotObject, comPortName);
		});

		comPort.on("close", function(err) {
			io.sockets.emit('console', comPortName + "-> " + err);
			io.sockets.emit('console', comPortName + "-> port closed");
			// console.log(err);
			// console.log(comPort.path + "-> port closed");
			delete sPorts[comPortName];
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
				DB.robots.find({robotName: json.NAME}, function(err, robots) {
					if(robots.length == 0) {
						DB.robots.save({
							robotName: json.NAME,
							game: json.GAME,
							state: robotObject.state,
						}, function(err, saved) {
							if(err) console.log(err);
							if(!saved) console.log('not saved');
						});
					}
				});
				break;
			case "STATE":
				if (robotObject.robotName == "") {
					robotObject.comPort.write("h");
				} else {
					robotObject.state = json.VALUE;
					DB.robots.find({robotName: robotObject.robotName}, function(err, robots) {
						if( robots.length == 0 ) {
							console.log("Fatal error writing state to database, robot not found!");
						} else {
							DB.robots.update({robotName: robotObject.robotName}, {$set: {state: json.VALUE}}, function(err, updated) {
								if( err || !updated ) console.log("Robot not updated");
  								else console.log("Robot ready");
							});
						}

					});
				}
				break;
			case "POINT":
				robotObject.points += json.VALUE;
				io.sockets.emit("game", robotObject.robotName + " has scored a point. Total: " + robotObject.points);
				break;
			case "PING":
				robotObject.pingRecieved = new Date().getTime();
				break;
			default:
				io.sockets.emit('console', robotObject.comPort.path + "-> JSON not valid (" + json.COMMAND + ")");
				// console.log(robotObject.comPort.path + "-> JSON not valid");
				break;
		}
	} catch (e) {
		io.sockets.emit('console', robotObject.comPort.path + "-> Error processing data: " + e);
		// console.log(robotObject.comPort.path + "-> Error processing data: " + e);
	}
}

var sendPing = setInterval(function() {
	for(var comPortName in sPorts) {
		try {
			if(sPorts[comPortName].robotName != "") {
				sPorts[comPortName].comPort.write("p");
				sPorts[comPortName].pingSend = new Date().getTime();
			}
		} catch(e) {
			console.log(e);
		}
	}
}, 500);

// var checkPing = setInterval(function() {
// 	for(var i = 0; i < sPorts.length; i++) {
// 		if(sPorts[i].robotName != "") {
// 			if((sPorts[i].pingSend - sPorts[i].pingRecieved) >= 1000) {
// 				io.sockets.emit("game", sPorts[i].robotName + " has lost connection.");
// 				var closeConnections = true;
// 				sPorts[i].comPort.close(function(err) {
// 					sPorts.splice(i, 1);
// 				});
// 			}
// 		}
// 	}
// 	if(closeConnections) {
// 		for(var i = sPorts.length - 1; i > -1; i--) {
// 			sPorts[i].comPort.close(function(err) {
// 				sPorts.splice(i, 1);
// 			});
// 		}
// 		io.sockets.emit("console", "Re init all connections");
// 	}
// }, 2000);
