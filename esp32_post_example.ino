#include <ArduinoBLE.h>
#include <WiFi.h>
#include <HTTPClient.h>

// BLE Setup
BLEService sensorService("19B10000-E8F2-537E-4F6C-D104768A1214");
BLECharacteristic sensorDataChar("19B10001-E8F2-537E-4F6C-D104768A1214", BLERead | BLENotify, 100); // max 100 bytes

// WiFi Setup
const char* ssid = "ZTE_2.4G_R4amY7";
const char* password = "k7MbUDQR";
String endpointUrl = "http://192.168.1.14:39000/sensor-data"; // <-- Replace with actual IP

unsigned long lastUpdate = 0;
const unsigned long updateInterval = 5000; // 5 seconds

void setup() {
  Serial.begin(115200);
  while (!Serial);

  // Start BLE
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

  // Connect to WiFi
  WiFi.begin(ssid, password);
  Serial.print("Connecting to WiFi");
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\nWiFi connected!");
}

void loop() {
  BLEDevice central = BLE.central();
  if (central) {
    Serial.print("Connected to: ");
    Serial.println(central.address());

    while (central.connected()) {
      if (millis() - lastUpdate > updateInterval) {
        lastUpdate = millis();
        sendSensorData(); // Send via BLE and HTTP
      }
    }

    Serial.println("Disconnected");
    BLE.end();
    delay(200);
    if (BLE.begin()) {
      BLE.setDeviceName("AerobandSensor");
      BLE.setLocalName("AerobandSensor");
      BLE.setAdvertisedService(sensorService);
      sensorService.addCharacteristic(sensorDataChar);
      BLE.addService(sensorService);
      sensorDataChar.writeValue("Initializing...");
      BLE.advertise();
      Serial.println("BLE advertising restarted (after reset)!");
    } else {
      Serial.println("BLE restart failed!");
    }
    delay(500);
  }

  // Still send sensor data even if BLE is not connected
  if (!central && millis() - lastUpdate > updateInterval) {
    lastUpdate = millis();
    sendSensorData();
  }
}

void sendSensorData() {
  float temp = 22.5 + random(-20, 20) / 10.0;
  float hum = 45.0 + random(-10, 10);
  float pres = 1013.25 + random(-50, 50) / 10.0;
  float alt = 100.0 + random(-20, 20);
  int airQ = 400 + random(-50, 100);
  unsigned long ts = millis();

  // JSON payload
  String jsonPayload = "{";
  jsonPayload += "\"t\":" + String(temp, 1) + ",";
  jsonPayload += "\"h\":" + String(hum, 1) + ",";
  jsonPayload += "\"p\":" + String(pres, 1) + ",";
  jsonPayload += "\"a\":" + String(alt, 1) + ",";
  jsonPayload += "\"q\":" + String(airQ) + ",";
  jsonPayload += "\"ts\":" + String(ts);
  jsonPayload += "}";

  // BLE Transmission
  sensorDataChar.writeValue(jsonPayload.c_str());
  Serial.println("BLE Sent: " + jsonPayload);

  // HTTP POST Transmission
  if (WiFi.status() == WL_CONNECTED) {
    HTTPClient http;
    http.begin(endpointUrl);
    http.addHeader("Content-Type", "application/json");

    // Adjusted payload format for API
    String postData = "{";
    postData += "\"value\":" + String(temp) + ",";
    postData += "\"type\":\"temperature\",";
    postData += "\"unit\":\"C\",";
    postData += "\"deviceId\":\"esp32-01\",";
    postData += "\"location\":\"lab\",";
    postData += "\"status\":\"ok\"";
    postData += "}";

    int httpCode = http.POST(postData);

    if (httpCode > 0) {
      String response = http.getString();
      Serial.println("HTTP POST OK: " + response);
    } else {
      Serial.println("HTTP POST Error: " + String(httpCode));
    }

    http.end();
  } else {
    Serial.println("WiFi not connected");
  }
}
