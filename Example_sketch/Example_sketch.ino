#include <ServerLib.h>

SoftwareSerial BT(7, 6); // tx pin, rx pin
ServerLib server(BT, "Robot naam", "Game naam");

void setup() {
  BT.gegin(9600);
  
}

void loop() {
  server.updateLoop() // Deze altijd aan het begin van de loop om een delay te voorkomen
  
  // Als de server verbonden is voer je de rest pas uit
  if(server.isConnected()) {
    
    // Als je robot klaar is met opstarten (bijv controller of laptop connected)
    server.setReadyState(true); // false als hij niet klaar is
    
    // Hij mag alleen rijden als de game gestart is
    if(server.hasGameStarted()) {
      // Ga iets doen
      // bijvoorbeeld een punt scoren
      
      // Als je een punt scoort doe het volgende:
      server.scorePoint();
    }
  }
}
