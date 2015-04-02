var express = require("express");
var serveStatic = require("serve-static");

var app = express();

var wPort = 3700;

var DBurl = "mongodb://arduino_user:banaan@dbh54.mongolab.com:27547/arduino_server";
var MongoJS = require("mongojs");
var DB = MongoJS.connect(DBurl, ["robots", "log"]);

DB.on("error", function(err) {
	console.log("Database error: " + err);
});

var LOGLEVEL = 3; // 1 = all; 2 = debugging; 3 = just critical stuf

app.use(serveStatic("./public/", { "index": ["index.html"] }));

var io = require("socket.io").listen(app.listen(wPort));
console.log("Listening on port " + wPort);


var adminSockets = io.of('/admin');

adminSockets.on('connection', function(socket) {
	socket.emit('console', 'Welcome');

	socket.on('updateScreenOverview', function(data) {
		updateScreenOverview();
	});

	socket.on('updateScreenCurrent', function(data) {
		updateScreenCurrent();
	});

	socket.on('updateAdmin', function(data) {
		updateAdmin();
	});

	socket.on('startGame', function(data) {
		startGame(data.value);
	});

	socket.on('stopGame', function() {
		isPlaying = false;
		for(var comPortName in sPorts) {
			if(sPorts[comPortName].game == currentGame) {
				sPorts[comPortName].comPort.write("s");
			}
		}
		if(timedGames.indexOf(currentGame) > -1)
			clearInterval(gameTimeInterval);
		updateScreenOverview();
		updateScreenCurrent();
		updateAdmin();
	});

});


var screenSockets = io.of('/screen');
screenSockets.on('connection', function(socket) {
	socket.emit('console', 'Welcome screen!');
	log("Screen connected.", 2);
});

var serialport = require('serialport');
var SerialPort = serialport.SerialPort;
var readData;

var sPorts = {};

function initComPorts() {
	serialport.list( function(err, ports) {
		ports.forEach( function(port) {
			if(!(port.comName in sPorts)) {
				sPorts[port.comName] = {
					comPort: new SerialPort(port.comName, { baudrate:9600, parser: serialport.parsers.readline("\r\n") }, false),
					recievedData: "",
					isOpen: false,
					robotName: "",
					game: "",
					state: "NOTREADY",
					points: 0,
					pingSend: 0,
					pingRecieved: 0
				};
				log(port.comName + "-> available.", 1);
			}
		});
		for(var comPort in sPorts) {
			if(!sPorts[comPort].isOpen) {
				log(comPort + "-> setting up", 1);
				setupPortHandler(sPorts[comPort], comPort);
			} else {
				log(comPort + "-> already open", 1);
			}
		}
	});
}

function setupPortHandler(robotObject, comPortName) {
	var comPort = robotObject.comPort;
	comPort.on("error", function(err) {
		log(comPortName + "-> On error: " + err, 2);
		closeComPort(robotObject);
	});

	comPort.open(function(err) {
		if (err) {
			log(comPortName + "-> Open error: " + err, 2);
			delete sPorts[comPortName];
			return;
		} else {
			log(comPortName + "-> Port open", 2);
			robotObject.isOpen = true;
			comPort.write("h"); // get handshake
			comPort.write("s"); // set gamestate to not started (s -> stop)
			comPort.write("r"); // get readystate
		}

		comPort.on("data", function(data){
			//log(comPortName + "-> Data: " + data, 3);
			processData(data, robotObject, comPortName);
		});

		comPort.on("close", function(err) {
			log(comPortName + "-> Serialport closed: " + err, 3);
			closeComPort(sPorts[comPortName]);
		});
	});
}

function processData(data, robotObject) {
	try {
		var json = JSON.parse(data);
		switch(json.COMMAND) {
			case "HANDSHAKE":
				processHandshake(json, robotObject);
				robotObject.comPort.write("p");
				break;
			case "STATE":
				processStateChange(json, robotObject)
				break;
			case "POINT":
				processPoint(robotObject);
				break;
			case "PING":
				robotObject.pingRecieved = new Date().getTime();
				break;
			default:
				log(robotObject.comPort.path + "-> JSON not valid (" + json.COMMAND + ")", 3);
				// console.log(robotObject.comPort.path + "-> JSON not valid");
				break;
		}
	} catch (e) {
		log(robotObject.comPort.path + "-> Error processing data: " + e + " !===! the data: " + data, 3);
		// console.log(robotObject.comPort.path + "-> Error processing data: " + e);
	}

}


function processHandshake(json, robotObject) {
	robotObject.robotName = json.NAME;
	robotObject.game = json.GAME;
	log(robotObject.robotName + " has send handshake to play " + robotObject.game, 2);
	DB.robots.update({ 	robotName: json.NAME }
					,{ 	robotName: json.NAME,
						game: json.GAME,
						state: robotObject.state,
						points: 0,
						isAlive: true }
					,{	upsert: true }
					,	function(err) {
							if(err) log(err, 2);
					});
	updateScreenOverview();
	updateAdmin();
}

function processStateChange(json, robotObject) {
	if (robotObject.robotName == "") {
		robotObject.comPort.write("h");
	} else {
		robotObject.state = json.VALUE;
		DB.robots.update({ 	robotName: robotObject.robotName }
						,{ 	state: json.VALUE }
						, 	function(err) {
								if(err) log(err, 2);
						});
	}
	updateAdmin();
}

var timedGames = ['Timed game 1', 'Timed game 2'];

function processPoint(robotObject) {
	if(robotObject.game == currentGame && isPlaying == true) {
		for(var timedGame in timedGames) {
			if(robotObject.game == timedGame) {
				clearInterval(gameTimeInterval);
				robotObject.points++;
				DB.robots.update({	robotName: robotObject.robotName}
								,{	$set: {points: robotObject.points}}
								, 	function(err, updated) {
										if(err||!updated) log(err, 3);
								});
				for(var comName in sPorts) {
					sPorts[comName].comPort.write("s");
				}
				isPlaying == false;
				return;
			} else {
				robotObject.points++;
				DB.robots.update({	robotName: robotObject.robotName}
								,{	$set: {points: robotObject.points}}
								, 	function(err, updated) {
										if(err||!updated) log(err, 3);
								});
				updateScreenCurrent();
				return;
			}
		}
	} else {
		log(robotObject.robotName + " tried to score a point without even playing the game.", 3);
	}
}

function startGame(gameName) {
	currentGame = gameName;
	var time = 10;
	var countDown = setInterval(function() {
		screenSockets.emit("timer", { "status": "countDown", "time": time });
		time--;
		if(time == -1) {
			clearInterval(countDown);
			screenSockets.emit("timer", { "status": "begin" });
			isPlaying = true;
			for(var comPortName in sPorts) {
				if(sPorts[comPortName].game == currentGame) {
					sPorts[comPortName].comPort.write("b");
				}
			}
			updateScreenOverview();
			updateScreenCurrent();
			updateAdmin();
			if(timedGames.indexOf(currentGame) > -1) {
				var gameStartTime = new Date().getTime(),
					gameElapsedTimeSec = '0.0',
					gameElapsedTimeMin = '0'

				var gameTimeInterval = setInterval(function() {
					var time = new Date().getTime() - gameStartTime;
					gameElapsedTimeSec = Math.floor(time / 100) / 10;

					if(gameElapsedTimeSec == 60) {
						gameStartTime = new Date().getTime();
						gameElapsedTimeMin++;
					}

					if(Math.round(gameElapsedTimeSec) == gameElapsedTimeSec)
						gameElapsedTimeSec += '.0';

					screenSockets.emit("timer", { "status": "game", "time": gameElapsedTimeMin + ":" + gameElapsedTimeSec });
				}, 100);
			} else {
				setTimeout(function() {
					screenSockets.emit("timer", { "status": "empty" });
				}, 5000);
			}
		}
	}, 1000);
}


var currentGame = "No game is playing";
var isPlaying = false;

function updateAdmin() {
	var games = {};
	DB.robots.find().forEach(function(err, robot) {
		if(robot != null) {
			if(!(robot.game in games)) {
				games[robot.game] = {};
				games[robot.game]["player1State"] = robot.state;
				games[robot.game]["player1Alive"] = robot.isAlive;
				games[robot.game]["player1"] = robot.robotName;
				games[robot.game]["mayStart"] = false;
			} else {
				games[robot.game]["player2State"] = robot.state;
				games[robot.game]["player2Alive"] = robot.isAlive;
				games[robot.game]["player2"] = robot.robotName;
				if(robot.state == "READY" && games[robot.game]["player1State"] == "READY"){
					games[robot.game]["mayStart"] = !isPlaying;
				} else {
					games[robot.game]["mayStart"] = false;
				}
			}
			games[robot.game]["isPlaying"] = isPlaying;
		}
		adminSockets.emit("updateControlPanel", games);
	});
}

function updateScreenOverview() {
	var games = {};
	DB.robots.find().forEach(function(err, robot) {
		if(robot != null) {
			if(robot.game != currentGame) {
				if(!(robot.game in games)) {
					games[robot.game] = {};
					games[robot.game]["player1Alive"] = robot.isAlive;
					games[robot.game]["playerName1"] = robot.robotName;
					games[robot.game]["playerPoints1"] = robot.points;
				} else {
					games[robot.game]["player2Alive"] = robot.isAlive;
					games[robot.game]["playerName2"] = robot.robotName;
					games[robot.game]["playerPoints2"] = robot.points;
				}
			}
		}
		screenSockets.emit("updateOverview", games);
	});
}

function updateScreenCurrent() {
	var game = {};
	DB.robots.find().forEach(function(err, robot) {
		if(!robot)
			return;
		if(robot.game == currentGame) {
			if(!("title" in game)) {
				game["title"] = robot.game;
				game["player1Alive"] = robot.isAlive;
				game["playerName1"] = robot.robotName;
				game["playerPoints1"] = robot.points;
			} else {
				game["player2Alive"] = robot.isAlive;
				game["playerName2"] = robot.robotName;
				game["playerPoints2"] = robot.points;
			}
		}
	});
	screenSockets.emit("updateCurrent", game);
}


function closeComPort(comPortObject) {
	var game = comPortObject.game;
	var name = comPortObject.robotName;
	comPortObject.robotName = "";
	comPortObject.comPort.close(function(err) {
		if(err) log(name + " -> Error closing comport:: " + err);
		if(game == currentGame) {
			isPlaying = false;
			for(var comPortName in sPorts) {
				if(sPorts[comPortName].game == currentGame) {
					sPorts[comPortName].comPort.write("s");
				}
			}
		}
		if(name != "") {
			DB.robots.update({	robotName: name }
							,{	isAlive: false }
							,{	upsert: false }
							,	function(err, updated) {
									if(err||!updated) log("Error updating database: " + err, 3);
							});
		}
		delete sPorts[comPortName];
		updateScreenCurrent();
		updateScreenOverview();
		updateScreenOverview();
	});
}

function log(message, level) {
	if(level >= LOGLEVEL) {
		var preparedMessage = getDateTime() + " -> " + message;
		adminSockets.emit('console', preparedMessage);
		DB.log.insert({
			"timeStamp": getDateTime(),
			"message": message
		}, function(err, inserted) {
			if(err) console.log("This is an error logging error: " + err);
			// if(inserted) console.log(inserted);
		});
	}
}

function getDateTime() {
    var now     = new Date();
    var year    = now.getFullYear();
    var month   = now.getMonth()+1;
    var day     = now.getDate();
    var hour    = now.getHours();
    var minute  = now.getMinutes();
    var second  = now.getSeconds();

    if(month.toString().length == 1) {
        var month = '0'+month;
    }
    if(day.toString().length == 1) {
        var day = '0'+day;
    }
    if(hour.toString().length == 1) {
        var hour = '0'+hour;
    }
    if(minute.toString().length == 1) {
        var minute = '0'+minute;
    }
    if(second.toString().length == 1) {
        var second = '0'+second;
    }
    var dateTime = year+'-'+month+'-'+day+' '+hour+':'+minute+':'+second;

    return dateTime;
}


// = = = = timers = = = =

var sendPing = setInterval(function() {
	for(var comPortName in sPorts) {
		if(sPorts[comPortName].robotName != "") {
			sPorts[comPortName].comPort.write("p");
			sPorts[comPortName].pingSend = new Date().getTime();
		}
	}
}, 500);

var checkPing = setInterval(function() {
	// for(var i = 0; i < sPorts.length; i++) {
	for(var comPortName in sPorts) {
		if(sPorts[comPortName].robotName != "") {
			if((sPorts[comPortName].pingSend - sPorts[comPortName].pingRecieved) >= 1000) {
				log(sPorts[comPortName].robotName + " has lost connection.");
				closeComPort(sPorts[comPortName]);
				updateScreenCurrent();
				updateScreenOverview();
			}
		}
	}

}, 2000);

var checkNewComports = setInterval(function() {
	initComPorts();
}, 3000);
