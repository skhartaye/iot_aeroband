/*
 * ESP32 MultiSensor BLE
 * 
 * IMPORTANT: If you get compilation errors about BLE library conflicts,
 * temporarily rename or move the ArduinoBLE library folder from:
 * C:\Users\skhart\Documents\Arduino\libraries\ArduinoBLE
 * to something like ArduinoBLE_backup
 * 
 * This will force the Arduino IDE to use only the ESP32's native BLE library.
 */

#include <SPI.h>
#include <Adafruit_Sensor.h>
#include <Adafruit_BME680.h>
#include <Wire.h>

// Explicitly use ESP32 BLE library
#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLEUtils.h>
#include <BLE2902.h>

// BLE Service and Characteristic UUIDs
#define SERVICE_UUID        "19b10000-e8f2-537e-4f6c-d104768a1214"
#define CHARACTERISTIC_UUID "19b10000-e8f2-537e-4f6c-d104768a1214"

// LED pins (optional, for status)
#define CONNECTION_LED 2  // Built-in LED
#define DATA_LED 4        // External LED for data transmission indication

// MQ-137 setup (Ammonia Sensor)
const int mq137AnalogPin = 34;  // GPIO 34 = Analog input
const float RL = 10.0;          // Load resistance in kOhms
const float R0 = 20.0;          // Sensor resistance in clean air (calibrate this value)
const float a = 102.2;          // NH3 curve parameter
const float b = -2.473;         // NH3 curve slope

// BME680 SPI setup
#define BME_CS 5 // Chip Select for BME680
Adafruit_BME680 bme(BME_CS); // Uses default SPI pins for MOSI, MISO, SCK

// PMS7003 UART pins
#define PMS7003_RX 16
#define PMS7003_TX 17
HardwareSerial pmsSerial(1); // UART1 for PMS7003

// BLE variables
BLEServer* pServer = NULL;
BLECharacteristic* pCharacteristic = NULL;
bool deviceConnected = false;
bool oldDeviceConnected = false; // To detect changes in connection state

class MyServerCallbacks: public BLEServerCallbacks {
    void onConnect(BLEServer* pServerInstance) {
        deviceConnected = true;
        digitalWrite(CONNECTION_LED, HIGH);
        Serial.println("[BLE] Client connected");
        Serial.println("[BLE] Device is advertising as: ESP32-MultiSensor");
        Serial.println("[BLE] Waiting for data transmission...");
        Serial.println("[BLE] Note: Cannot retrieve client (phone) address using Arduino BLE library.");
    };

    void onDisconnect(BLEServer* pServerInstance) {
        deviceConnected = false;
        digitalWrite(CONNECTION_LED, LOW);
        Serial.println("[BLE] Client disconnected");
        Serial.println("[BLE] Restarting advertising...");
    }
};

void setup() {
    Serial.begin(115200);
    delay(1000);

    pinMode(CONNECTION_LED, OUTPUT);
    pinMode(DATA_LED, OUTPUT);
    digitalWrite(CONNECTION_LED, LOW);
    digitalWrite(DATA_LED, LOW);

    Serial.println("[SYSTEM] Booting ESP32 MultiSensor BLE...");
    
    // Initialize MQ-137 (No specific init needed for analog read)
    analogReadResolution(10); // Set ADC resolution (10-bit for 0-1023)

    // Initialize BME680
    if (!bme.begin()) {
        Serial.println("Could not find a valid BME680 sensor, check wiring!");
        while (1); // Halt
    }
    bme.setTemperatureOversampling(BME680_OS_8X);
    bme.setHumidityOversampling(BME680_OS_2X);
    bme.setPressureOversampling(BME680_OS_4X);
    bme.setIIRFilterSize(BME680_FILTER_SIZE_3);
    bme.setGasHeater(320, 150); // 320*C for 150ms

    // Initialize PMS7003
    pmsSerial.begin(9600, SERIAL_8N1, PMS7003_RX, PMS7003_TX);

    // Initialize BLE
    BLEDevice::init("ESP32-MultiSensor");
    pServer = BLEDevice::createServer();
    pServer->setCallbacks(new MyServerCallbacks());

    BLEService *pService = pServer->createService(SERVICE_UUID);
    pCharacteristic = pService->createCharacteristic(
                        CHARACTERISTIC_UUID,
                        BLECharacteristic::PROPERTY_READ |
                        BLECharacteristic::PROPERTY_NOTIFY
                      );
    pCharacteristic->addDescriptor(new BLE2902());

    pService->start();
    BLEAdvertising *pAdvertising = BLEDevice::getAdvertising();
    pAdvertising->addServiceUUID(SERVICE_UUID);
    pAdvertising->setScanResponse(true);
    pAdvertising->setMinPreferred(0x06);
    pAdvertising->setMinPreferred(0x12);
    BLEDevice::startAdvertising();
    Serial.println("[BLE] BLE device initialized and advertising");
}

void loop() {
    if (deviceConnected) {
        digitalWrite(DATA_LED, HIGH);
        
        // Read sensor data with new format
        float temp = 22.5 + random(-25, 25) / 10.0;
        float hum = 40.0 + random(-20, 20) / 10.0;
        float pressure = 1005.0 + random(-50, 50) / 10.0;  // hPa
        float gas_resistance = 30.0 + random(-10, 10) / 10.0;  // kΩ
        int pm1 = random(0, 30);
        int pm25 = random(5, 60);
        int pm10 = random(10, 80);
        float nh3 = simulateNH3();

        // Store previous values for change calculation
        static float prev_temp = 0, prev_hum = 0, prev_pressure = 0, prev_gas_resistance = 0, prev_nh3 = 0;
        static int prev_pm1 = 0, prev_pm25 = 0, prev_pm10 = 0;
        
        // Calculate changes
        float temp_change = temp - prev_temp;
        float humidity_change = hum - prev_hum;
        float pressure_change = pressure - prev_pressure;
        float gas_change = gas_resistance - prev_gas_resistance;
        float ammonia_change = nh3 - prev_nh3;
        int pm1_change = pm1 - prev_pm1;
        int pm25_change = pm25 - prev_pm25;
        int pm10_change = pm10 - prev_pm10;
        
        // Calculate percentage changes (avoid division by zero)
        float temp_pct = (prev_temp != 0) ? (temp_change / prev_temp) * 100 : 0;
        float humidity_pct = (prev_hum != 0) ? (humidity_change / prev_hum) * 100 : 0;
        float pressure_pct = (prev_pressure != 0) ? (pressure_change / prev_pressure) * 100 : 0;
        float gas_pct = (prev_gas_resistance != 0) ? (gas_change / prev_gas_resistance) * 100 : 0;
        float ammonia_pct = (prev_nh3 != 0) ? (ammonia_change / prev_nh3) * 100 : 0;
        float pm1_pct = (prev_pm1 != 0) ? (pm1_change / (float)prev_pm1) * 100 : 0;
        float pm25_pct = (prev_pm25 != 0) ? (pm25_change / (float)prev_pm25) * 100 : 0;
        float pm10_pct = (prev_pm10 != 0) ? (pm10_change / (float)prev_pm10) * 100 : 0;
        
        // Determine status based on values
        const char* temp_status = (temp >= 20 && temp <= 30) ? "Normal" : "Warning";
        const char* humidity_status = (hum >= 40 && hum <= 70) ? "Normal" : "Warning";
        const char* pressure_status = (pressure >= 1000 && pressure <= 1020) ? "Normal" : "Warning";
        const char* gas_status = (gas_resistance >= 10 && gas_resistance <= 50) ? "Normal" : "Warning";
        const char* ammonia_status = (nh3 <= 1.0) ? "Normal" : "Warning";
        const char* pm1_status = (pm1 <= 50) ? "Normal" : "Warning";
        const char* pm25_status = (pm25 <= 35) ? "Normal" : "Warning";
        const char* pm10_status = (pm10 <= 150) ? "Normal" : "Warning";
        
        // Construct enhanced JSON payload
        char jsonData[800]; 
        snprintf(jsonData, sizeof(jsonData),
                 "{\"temperature\":{\"value\":%.2f,\"status\":\"%s\",\"change\":%.1f,\"change_pct\":%.1f},"
                 "\"humidity\":{\"value\":%.2f,\"status\":\"%s\",\"change\":%.1f,\"change_pct\":%.1f},"
                 "\"pressure\":{\"value\":%.2f,\"status\":\"%s\",\"change\":%.1f,\"change_pct\":%.1f},"
                 "\"gas_resistance\":{\"value\":%.2f,\"status\":\"%s\",\"change\":%.1f,\"change_pct\":%.1f},"
                 "\"ammonia\":{\"value\":%.2f,\"status\":\"%s\",\"change\":%.1f,\"change_pct\":%.1f},"
                 "\"pm1\":{\"value\":%d,\"status\":\"%s\",\"change\":%d,\"change_pct\":%.1f},"
                 "\"pm25\":{\"value\":%d,\"status\":\"%s\",\"change\":%d,\"change_pct\":%.1f},"
                 "\"pm10\":{\"value\":%d,\"status\":\"%s\",\"change\":%d,\"change_pct\":%.1f}}",
                 temp, temp_status, temp_change, temp_pct,
                 hum, humidity_status, humidity_change, humidity_pct,
                 pressure, pressure_status, pressure_change, pressure_pct,
                 gas_resistance, gas_status, gas_change, gas_pct,
                 nh3, ammonia_status, ammonia_change, ammonia_pct,
                 pm1, pm1_status, pm1_change, pm1_pct,
                 pm25, pm25_status, pm25_change, pm25_pct,
                 pm10, pm10_status, pm10_change, pm10_pct);
        
        // Update previous values for next iteration
        prev_temp = temp;
        prev_hum = hum;
        prev_pressure = pressure;
        prev_gas_resistance = gas_resistance;
        prev_nh3 = nh3;
        prev_pm1 = pm1;
        prev_pm25 = pm25;
        prev_pm10 = pm10;
        
        Serial.print("[BLE] Sending data to connected device: ");
        Serial.println(jsonData);  // Your JSON data
        
        pCharacteristic->setValue(jsonData);
        pCharacteristic->notify();
        digitalWrite(DATA_LED, LOW);
        Serial.println("[BLE] Data sent and DATA_LED toggled");
    }

    if (!deviceConnected && oldDeviceConnected) {
        delay(500);
        BLEDevice::startAdvertising();
        Serial.println("[BLE] Advertising restarted after disconnect");
        oldDeviceConnected = deviceConnected;
    }
    if (deviceConnected && !oldDeviceConnected) {
        Serial.println("[BLE] Device reconnected");
        oldDeviceConnected = deviceConnected;
    }
    
    delay(5000);
} 