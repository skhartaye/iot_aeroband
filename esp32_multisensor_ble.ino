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
#define SERVICE_UUID        "4fafc201-1fb5-459e-8fcc-c5c9c331914b"
#define CHARACTERISTIC_UUID "beb5483e-36e1-4688-b7f5-ea07361b26a8"

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
        
        // MQ-137 Data
        int rawValue = analogRead(mq137AnalogPin);
        float voltage = rawValue * (3.3 / 1023.0);
        float RS = (voltage == 0) ? 1000000.0 : ((3.3 * RL) / voltage) - RL; // Avoid div by zero
        float rsRatio = RS / R0;
        float ammoniaPPM = (rsRatio <= 0) ? 0.0 : a * pow(rsRatio, b); // Avoid pow with negative base if RS/R0 is problematic
        if (ammoniaPPM < 0 || isnan(ammoniaPPM) || isinf(ammoniaPPM)) ammoniaPPM = 0.0;

        // BME680 Data
        float temperature = NAN, humidity = NAN, pressure = NAN, gas_resistance = NAN;
        if (bme.performReading()) {
            temperature = bme.temperature;
            humidity = bme.humidity;
            pressure = bme.pressure / 100.0; // Convert Pa to hPa
            gas_resistance = bme.gas_resistance / 1000.0; // Convert Ohms to kOhms
        } else {
            Serial.println("Failed to perform BME680 reading");
        }

        // PMS7003 Data
        unsigned int pm1_0_val = 0, pm2_5_val = 0, pm10_val = 0;
        byte pmsBuffer[32];
        int pmsCount = 0;
        unsigned long pmsStartTime = millis();
        while (pmsSerial.available() && (millis() - pmsStartTime < 1000)) { // Read with 1s timeout
            if (pmsCount < 32) pmsBuffer[pmsCount++] = pmsSerial.read();
            else pmsSerial.read(); // Discard extra bytes if buffer is full
        }

        if (pmsCount == 32 && pmsBuffer[0] == 0x42 && pmsBuffer[1] == 0x4D) {
            pm1_0_val = (pmsBuffer[10] << 8) | pmsBuffer[11];
            pm2_5_val = (pmsBuffer[12] << 8) | pmsBuffer[13];
            pm10_val = (pmsBuffer[14] << 8) | pmsBuffer[15];
        } else {
            // Serial.println("PMS7003 reading failed or data incomplete.");
        }

        // Store previous values for change calculation
        static float prev_temperature = 0, prev_humidity = 0, prev_pressure = 0, prev_gas_resistance = 0, prev_ammonia = 0;
        static unsigned int prev_pm1_0 = 0, prev_pm2_5 = 0, prev_pm10 = 0;
        
        // Calculate changes
        float temp_change = temperature - prev_temperature;
        float humidity_change = humidity - prev_humidity;
        float pressure_change = pressure - prev_pressure;
        float gas_change = gas_resistance - prev_gas_resistance;
        float ammonia_change = ammoniaPPM - prev_ammonia;
        int pm1_0_change = pm1_0_val - prev_pm1_0;
        int pm2_5_change = pm2_5_val - prev_pm2_5;
        int pm10_change = pm10_val - prev_pm10;
        
        // Calculate percentage changes (avoid division by zero)
        float temp_pct = (prev_temperature != 0) ? (temp_change / prev_temperature) * 100 : 0;
        float humidity_pct = (prev_humidity != 0) ? (humidity_change / prev_humidity) * 100 : 0;
        float pressure_pct = (prev_pressure != 0) ? (pressure_change / prev_pressure) * 100 : 0;
        float gas_pct = (prev_gas_resistance != 0) ? (gas_change / prev_gas_resistance) * 100 : 0;
        float ammonia_pct = (prev_ammonia != 0) ? (ammonia_change / prev_ammonia) * 100 : 0;
        float pm1_0_pct = (prev_pm1_0 != 0) ? (pm1_0_change / (float)prev_pm1_0) * 100 : 0;
        float pm2_5_pct = (prev_pm2_5 != 0) ? (pm2_5_change / (float)prev_pm2_5) * 100 : 0;
        float pm10_pct = (prev_pm10 != 0) ? (pm10_change / (float)prev_pm10) * 100 : 0;
        
        // Determine status based on values
        const char* temp_status = (temperature >= 20 && temperature <= 30) ? "Normal" : "Warning";
        const char* humidity_status = (humidity >= 40 && humidity <= 70) ? "Normal" : "Warning";
        const char* pressure_status = (pressure >= 1000 && pressure <= 1020) ? "Normal" : "Warning";
        const char* gas_status = (gas_resistance >= 10 && gas_resistance <= 50) ? "Normal" : "Warning";
        const char* ammonia_status = (ammoniaPPM <= 1.0) ? "Normal" : "Warning";
        const char* pm1_0_status = (pm1_0_val <= 50) ? "Normal" : "Warning";
        const char* pm2_5_status = (pm2_5_val <= 35) ? "Normal" : "Warning";
        const char* pm10_status = (pm10_val <= 150) ? "Normal" : "Warning";
        
        // Construct enhanced JSON payload
        char jsonData[800]; 
        snprintf(jsonData, sizeof(jsonData),
                 "{\"temperature\":{\"value\":%.2f,\"status\":\"%s\",\"change\":%.1f,\"change_pct\":%.1f},"
                 "\"humidity\":{\"value\":%.2f,\"status\":\"%s\",\"change\":%.1f,\"change_pct\":%.1f},"
                 "\"pressure\":{\"value\":%.2f,\"status\":\"%s\",\"change\":%.1f,\"change_pct\":%.1f},"
                 "\"gas_resistance\":{\"value\":%.2f,\"status\":\"%s\",\"change\":%.1f,\"change_pct\":%.1f},"
                 "\"ammonia\":{\"value\":%.2f,\"status\":\"%s\",\"change\":%.1f,\"change_pct\":%.1f},"
                 "\"pm1_0\":{\"value\":%u,\"status\":\"%s\",\"change\":%d,\"change_pct\":%.1f},"
                 "\"pm2_5\":{\"value\":%u,\"status\":\"%s\",\"change\":%d,\"change_pct\":%.1f},"
                 "\"pm10\":{\"value\":%u,\"status\":\"%s\",\"change\":%d,\"change_pct\":%.1f}}",
                 isnan(temperature) ? 0.00 : temperature, temp_status, temp_change, temp_pct,
                 isnan(humidity) ? 0.00 : humidity, humidity_status, humidity_change, humidity_pct,
                 isnan(pressure) ? 0.00 : pressure, pressure_status, pressure_change, pressure_pct,
                 isnan(gas_resistance) ? 0.00 : gas_resistance, gas_status, gas_change, gas_pct,
                 ammoniaPPM, ammonia_status, ammonia_change, ammonia_pct,
                 pm1_0_val, pm1_0_status, pm1_0_change, pm1_0_pct,
                 pm2_5_val, pm2_5_status, pm2_5_change, pm2_5_pct,
                 pm10_val, pm10_status, pm10_change, pm10_pct);
        
        // Update previous values for next iteration
        prev_temperature = isnan(temperature) ? 0.00 : temperature;
        prev_humidity = isnan(humidity) ? 0.00 : humidity;
        prev_pressure = isnan(pressure) ? 0.00 : pressure;
        prev_gas_resistance = isnan(gas_resistance) ? 0.00 : gas_resistance;
        prev_ammonia = ammoniaPPM;
        prev_pm1_0 = pm1_0_val;
        prev_pm2_5 = pm2_5_val;
        prev_pm10 = pm10_val;
        
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