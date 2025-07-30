#include <ArduinoBLE.h>

BLEService sensorService("19b10000-e8f2-537e-4f6c-d104768a1214");
BLECharacteristic sensorDataChar("19b10000-e8f2-537e-4f6c-d104768a1214",
                                 BLERead | BLENotify, 100); // Up to 100 bytes

unsigned long lastUpdate = 0;
const unsigned long updateInterval = 2000;  // Every 2 seconds

void setup() {
  Serial.begin(115200);
  while (!Serial);

  if (!BLE.begin()) {
    Serial.println("BLE start failed!");
    while (1);
  }

  BLE.setDeviceName("AerobandSensor");
  BLE.setLocalName("AerobandSensor");
  BLE.setAdvertisedService(sensorService);

  sensorService.addCharacteristic(sensorDataChar);
  BLE.addService(sensorService);

  sensorDataChar.writeValue("Initializing...");

  BLE.advertise();
  Serial.println("BLE advertising started!");
}

void loop() {
  BLEDevice central = BLE.central();

  if (central) {
    Serial.print("Connected to: ");
    Serial.println(central.address());

    while (central.connected()) {
      if (millis() - lastUpdate > updateInterval) {
        lastUpdate = millis();
        sendSensorData();
      }
    }

    Serial.println("Disconnected");
    resetBLE();
  }
}

void resetBLE() {
  BLE.end();
  delay(200);
  if (BLE.begin()) {
    BLE.setDeviceName("AerobandSensor");
    BLE.setLocalName("AerobandSensor");
    BLE.setAdvertisedService(sensorService);
    sensorService.addCharacteristic(sensorDataChar);
    BLE.addService(sensorService);
    sensorDataChar.writeValue("Reinitialized...");
    BLE.advertise();
    Serial.println("BLE advertising restarted (after reset)!");
  } else {
    Serial.println("BLE restart failed!");
  }
  delay(500);
}

float simulateNH3() {
  float RL = 10.0;
  float R0 = 20.0;
  float a = 102.2;
  float b = -2.473;
  float RS = random(500, 2000) / 100.0; // Simulate 5–20 kOhm
  float ratio = RS / R0;
  float ppm = a * pow(ratio, b);
  return max(ppm, 0.0f);
}

void sendSensorData() {
  float temp = 22.5 + random(-25, 25) / 10.0;
  float hum = 40.0 + random(-20, 20) / 10.0;
  int pm1 = random(0, 30);
  int pm25 = random(5, 60);
  int pm10 = random(10, 80);
  float nh3 = simulateNH3();

  // Compact JSON payload
  String jsonPayload = "{";
  jsonPayload += "\"temp\":" + String(temp, 1) + ",";
  jsonPayload += "\"hum\":" + String(hum, 1) + ",";
  jsonPayload += "\"pm1\":" + String(pm1) + ",";
  jsonPayload += "\"pm25\":" + String(pm25) + ",";
  jsonPayload += "\"pm10\":" + String(pm10) + ",";
  jsonPayload += "\"nh3\":" + String(nh3, 2);
  jsonPayload += "}";

  Serial.println("Sending: " + jsonPayload);
  sensorDataChar.writeValue(jsonPayload.c_str());
} 