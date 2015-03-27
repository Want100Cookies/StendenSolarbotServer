var express = require("express");
var app = express();

var wPort = 3700;

app.get("/", function(req, res) {
	res.sendfile("./public/screen.html");
});

app.get("/admin", function(req, res) {
	res.sendfile("./public/admin.html");
});


var DBurl = "mongodb://arduino_user:banaan@dbh54.mongolab.com:27547/arduino_server";
var MongoJS = require("mongojs");
var DB = MongoJS.connect(DBurl, ["robots", "log"]);

var io = require("socket.io").listen(app.listen(wPort));
console.log("Listening on port " + wPort);


var adminSockets = io.of('/admin');

adminSockets.on('connection', function(socket) {
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

	socket.on('updateCurrent', function(data) {
		screenSockets.emit('updateCurrent', {
			playerName1: "Robot 1",
			playerName2: "Robot 2",
			playerPoints1: "5",
			playerPoints2: "2",
			title: "Capture the flag"
		});
	});

	socket.on('updateOverview', function(data) {
		screenSockets.emit('updateOverview', {
			'game 1': {
				playerName1: 'player 1',
				playerPoints1: '2',
				playerName2: 'player 2',
				playerPoints2: '7'
			},
			'game 2': {
				playerName1: 'player 1',
				playerPoints1: '2',
				playerName2: 'player 2',
				playerPoints2: '7'
			},
			'game 3': {
				playerName1: 'player 1',
				playerPoints1: '2',
				playerName2: 'player 2',
				playerPoints2: '7'
			}
		});
	});
});


var screenSockets = io.of('/screen');
screenSockets.on('connection', function(socket) {
	socket.emit('console', 'Welcome screen!');
	console.log("Screen connected.");
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
				processPoint(robotObject);
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

var timedGames = ['Timed game 1', 'Timed game 2'];

var processPoint = function(robotObject) {
	for(var timedGame in timedGames) {
		if(robotObject.game == timedGame) {

			return;
		} else {
			robotObject.points++;
			DB.robots.update({robotName: robotObject.robotName}, {$set: {points: robotObject.points}}, function(err, updated) {
				if(err||!updated) console.log(err);
			});

			return;
		}
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
