#include <SPI.h>
#include <Adafruit_Sensor.h>
#include "Adafruit_BME680.h"
#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLEUtils.h>
#include <BLE2902.h>

// BLE UUIDs
#define SERVICE_UUID        "4fafc201-1fb5-459e-8fcc-c5c9c331914b"
#define CHARACTERISTIC_UUID "beb5483e-36e1-4688-b7f5-ea07361b26a8"

// MiCS-5524 analog pin setup
const int coPin   = 34;
const int nh3Pin  = 35;
const int no2Pin  = 32;

const float RL = 10.0; // Load resistor in kΩ
const float R0_CO   = 10.0; // Replace with calibrated value
const float R0_NH3  = 10.0;
const float R0_NO2  = 10.0;

// Placeholder curve constants for each gas (tweak for real accuracy)
const float a_CO   = 100.0, b_CO   = -1.5;
const float a_NH3  = 100.0, b_NH3  = -1.5;
const float a_NO2  = 100.0, b_NO2  = -1.5;

// BME680 setup
#define BME_CS 5
Adafruit_BME680 bme(BME_CS);

// PMS7003 UART
#define PMS7003_RX 16
#define PMS7003_TX 17
HardwareSerial pmsSerial(1);

// BLE
BLEServer* pServer = NULL;
BLECharacteristic* pCharacteristic = NULL;
bool deviceConnected = false;
bool oldDeviceConnected = false;

class MyServerCallbacks: public BLEServerCallbacks {
  void onConnect(BLEServer* pServerInstance) {
    deviceConnected = true;
    Serial.println("[BLE] ✅ Client connected successfully!");
  }
  void onDisconnect(BLEServer* pServerInstance) {
    deviceConnected = false;
    Serial.println("[BLE] ❌ Client disconnected - restarting advertising...");
  }
};

void setup() {
  Serial.begin(115200);
  delay(1000);

  analogReadResolution(10); // ESP32 ADC = 0–1023

  // BME680 - Optimized for faster readings
  Serial.println("[BME680] Initializing...");
  if (!bme.begin()) {
    Serial.println("[BME680] Could not find BME680!");
    while (1);
  }
  
  // Faster BME680 settings
  bme.setTemperatureOversampling(BME680_OS_2X);  // Reduced from 8X
  bme.setHumidityOversampling(BME680_OS_1X);     // Reduced from 2X
  bme.setPressureOversampling(BME680_OS_2X);     // Reduced from 4X
  bme.setIIRFilterSize(BME680_FILTER_SIZE_0);    // No filtering for speed
  bme.setGasHeater(320, 100); // Reduced heating time from 150ms to 100ms
  
  Serial.println("[BME680] Initialized successfully");

  // PMS7003
  pmsSerial.begin(9600, SERIAL_8N1, PMS7003_RX, PMS7003_TX);

  // BLE - Optimized for faster connection
  BLEDevice::init("ESP32-MultiSensor");
  pServer = BLEDevice::createServer();
  pServer->setCallbacks(new MyServerCallbacks());

  BLEService *pService = pServer->createService(SERVICE_UUID);
  pCharacteristic = pService->createCharacteristic(
    CHARACTERISTIC_UUID,
    BLECharacteristic::PROPERTY_READ | BLECharacteristic::PROPERTY_NOTIFY
  );
  pCharacteristic->addDescriptor(new BLE2902());

  pService->start();
  
  // Optimized advertising parameters for faster discovery
  BLEAdvertising *pAdvertising = BLEDevice::getAdvertising();
  pAdvertising->addServiceUUID(SERVICE_UUID);
  pAdvertising->setScanResponse(true);
  pAdvertising->setMinPreferred(0x06);  // 7.5ms
  pAdvertising->setMaxPreferred(0x06);  // 7.5ms - faster advertising
  pAdvertising->setMinInterval(0x20);   // 20ms
  pAdvertising->setMaxInterval(0x40);   // 40ms
  
  Serial.println("[BLE] Starting optimized advertising...");
  BLEDevice::startAdvertising();
  Serial.println("[BLE] Ready to connect!");
}

float computePPM(int adc, float R0, float a, float b) {
  float voltage = adc * (3.3 / 1023.0);
  if (voltage == 0) return 0.0;
  float Rs = ((3.3 * RL) / voltage) - RL;
  float ratio = Rs / R0;
  float ppm = a * pow(ratio, b);
  if (ppm < 0 || isnan(ppm) || isinf(ppm)) return 0.0;
  return ppm;
}

void loop() {
  if (deviceConnected) {
    // MiCS-5524
    int adcCO = analogRead(coPin);
    int adcNH3 = analogRead(nh3Pin);
    int adcNO2 = analogRead(no2Pin);
    float coPPM = computePPM(adcCO, R0_CO, a_CO, b_CO);
    float nh3PPM = computePPM(adcNH3, R0_NH3, a_NH3, b_NH3);
    float no2PPM = computePPM(adcNO2, R0_NO2, a_NO2, b_NO2);

    // BME680
    float temp = NAN, humid = NAN, press = NAN, gas = NAN;
    if (bme.performReading()) {
      temp = bme.temperature;
      humid = bme.humidity;
      press = bme.pressure / 100.0;
      gas = bme.gas_resistance / 1000.0;
    }

    // PMS7003
    unsigned int pm1_0 = 0, pm2_5 = 0, pm10 = 0;
    byte buf[32];
    int count = 0;
    unsigned long start = millis();
    while (pmsSerial.available() && millis() - start < 1000) {
      if (count < 32) buf[count++] = pmsSerial.read();
      else pmsSerial.read();
    }
    if (count == 32 && buf[0] == 0x42 && buf[1] == 0x4D) {
      pm1_0 = (buf[10] << 8) | buf[11];
      pm2_5 = (buf[12] << 8) | buf[13];
      pm10  = (buf[14] << 8) | buf[15];
    }

    // JSON BLE Payload
    char jsonData[400];
    snprintf(jsonData, sizeof(jsonData),
      "{\"temperature\":%.2f,\"humidity\":%.2f,\"pressure\":%.2f,\"gas_resistance\":%.2f,"
      "\"co\":%.2f,\"nh3\":%.2f,\"no2\":%.2f,\"pm1_0\":%u,\"pm2_5\":%u,\"pm10\":%u}",
      isnan(temp) ? 0.0 : temp,
      isnan(humid) ? 0.0 : humid,
      isnan(press) ? 0.0 : press,
      isnan(gas) ? 0.0 : gas,
      coPPM, nh3PPM, no2PPM,
      pm1_0, pm2_5, pm10
    );

    Serial.println("[BLE] Sending:");
    Serial.println(jsonData);
    pCharacteristic->setValue(jsonData);
    pCharacteristic->notify();
  }

  if (!deviceConnected && oldDeviceConnected) {
    delay(500);
    BLEDevice::startAdvertising();
    oldDeviceConnected = deviceConnected;
  }

  if (deviceConnected && !oldDeviceConnected) {
    oldDeviceConnected = deviceConnected;
  }

  delay(2000); // Reduced delay for faster response
}



