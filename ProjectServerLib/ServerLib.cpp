#include "Arduino.h"
#include "ServerLib.h"
#include <SoftwareSerial.h>

ServerLib::ServerLib(int rx, int tx, String naam, String game) : _bt(rx, tx) {
	_naam = naam;
	_game = game;

	_bt.begin(9600);
}

void ServerLib::updateLoop() {
	if(_bt.available() > 0) {
		char data = _bt.read();
		if(data == 'h') {
			_bt.print("{\"COMMAND\":\"HANDSHAKE\", \"NAME\":\"");
			_bt.print(_naam);
			_bt.print("\", \"GAME\":\"");
			_bt.print(_game);
			_bt.println("\"}");
		} else if(data == 'b') {
			_started = true;
		} else if(data == 's') {
			_started = false;
		} else if(data == 'p') {
			_bt.println("{\"COMMAND\":\"PING\"}");
			_connected = true;
			_lastPing = millis();
		}
	}

	if(_connected && ((millis() - _lastPing) > 1000)) {
		_connected = false;
	}
}

void ServerLib::setReadyState(bool state) {
	if(state) {
		_bt.println("{\"COMMAND\":\"STATE\", \"VALUE\":\"READY\"}");
	} else {
		_bt.println("{\"COMMAND\":\"STATE\", \"VALUE\":\"NOTREADY\"}");
	}
}

bool ServerLib::hasGameStarted() {
	return _started;
}

bool ServerLib::isConnected() {
	return _connected;
}

void ServerLib::scorePoint() { 
	_bt.println("{\"COMMAND\":\"POINT\"}");
}