#ifndef ServerLib_h
#define ServerLib_h

#include "Arduino.h"
#include <SoftwareSerial.h>

class ServerLib {
  public:
    ServerLib(int rx, int tx, String naam, String game);
    void updateLoop();
    void setReadyState(bool state);
    bool hasGameStarted();
    void scorePoint();
  private:
    String _naam;
    String _game;
    SoftwareSerial _bt;
    bool _started;
    bool _connected;
};

#endif