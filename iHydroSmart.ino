#include <WiFiS3.h>
#include <DHT.h>

// ========== Wi-Fi Configuration ==========
This part of the code is where you define the Wi-Fi and server configuration details for your IoT device. Let me break it down for you:
const char* ssid = "YOUR_WIFI_SSID";        // เปลี่ยนเป็น Wi-Fi ของคุณ
const char* password = "YOUR_WIFI_PASSWORD"; // เปลี่ยนเป็นรหัส Wi-Fi
const char* serverIP = "192.168.1.100";      // IP ของเครื่องที่รัน Node.js
const int serverPort = 3000;

// ========== Sensor Pins ==========
#define DHTPIN 2           // DHT22 Temperature & Humidity
#define DHTTYPE DHT22
#define LDR_PIN A0         // LDR Light Sensor
#define EC_PIN A1          // EC Sensor
#define PH_PIN A2          // pH Sensor
#define TRIG_PIN 9         // Ultrasonic Trigger
#define ECHO_PIN 10        // Ultrasonic Echo

DHT dht(DHTPIN, DHTTYPE);
WiFiClient client;

// ========== Variables ==========
float temperature = 0;
float humidity = 0;
float lightLevel = 0;
float ecValue = 0;
float tdsValue = 0;
float phValue = 0;
float waterLevel = 0;

unsigned long lastSendTime = 0;
const unsigned long sendInterval = 5000; // ส่งข้อมูลทุก 5 วินาที

// ========== Setup ==========
void setup() {
  Serial.begin(115200);
  delay(1000);

  // Initialize Sensors
  dht.begin();
  pinMode(TRIG_PIN, OUTPUT);
  pinMode(ECHO_PIN, INPUT);

  // Connect to Wi-Fi
  Serial.println("🌐 Connecting to Wi-Fi...");
  WiFi.begin(ssid, password);

  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 20) {
    delay(500);
    Serial.print(".");
    attempts++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\n✅ Wi-Fi Connected!");
    Serial.print("📡 IP Address: ");
    Serial.println(WiFi.localIP());
  } else {
    Serial.println("\n❌ Wi-Fi Connection Failed!");
  }
}

// ========== Main Loop ==========
void loop() {
  if (millis() - lastSendTime >= sendInterval) {
    readSensors();
    sendDataToServer();
    lastSendTime = millis();
  }
}

// ========== Read All Sensors ==========
void readSensors() {
  // DHT22 - Temperature & Humidity
  temperature = dht.readTemperature();
  humidity = dht.readHumidity();

  if (isnan(temperature) || isnan(humidity)) {
    Serial.println("❌ Failed to read from DHT sensor!");
    temperature = 0;
    humidity = 0;
  }

  // LDR - Light Level
  int ldrValue = analogRead(LDR_PIN);
  lightLevel = map(ldrValue, 0, 1023, 0, 1000); // แปลงเป็น Lux (ประมาณ)

  // EC Sensor (ค่าสารอาหารในน้ำ)
  int ecRaw = analogRead(EC_PIN);
  ecValue = (ecRaw / 1023.0) * 5.0; // แปลงเป็น mS/cm
  tdsValue = ecValue * 500;         // TDS (ppm) ประมาณจาก EC

  // pH Sensor
  int phRaw = analogRead(PH_PIN);
  phValue = (phRaw / 1023.0) * 14.0; // แปลงเป็น pH (0-14)

  // Ultrasonic - Water Level
  digitalWrite(TRIG_PIN, LOW);
  delayMicroseconds(2);
  digitalWrite(TRIG_PIN, HIGH);
  delayMicroseconds(10);
  digitalWrite(TRIG_PIN, LOW);

  long duration = pulseIn(ECHO_PIN, HIGH);
  waterLevel = duration * 0.034 / 2; // แปลงเป็น cm

  // Print to Serial Monitor
  Serial.println("\n========== Sensor Readings ==========");
  Serial.print("🌡️ Temperature: "); Serial.print(temperature); Serial.println(" °C");
  Serial.print("💧 Humidity: "); Serial.print(humidity); Serial.println(" %");
  Serial.print("☀️ Light: "); Serial.print(lightLevel); Serial.println(" Lux");
  Serial.print("🌿 EC: "); Serial.print(ecValue); Serial.println(" mS/cm");
  Serial.print("💎 TDS: "); Serial.print(tdsValue); Serial.println(" ppm");
  Serial.print("🧪 pH: "); Serial.println(phValue);
  Serial.print("🚰 Water Level: "); Serial.print(waterLevel); Serial.println(" cm");
  Serial.println("=====================================");
}

// ========== Send Data to Server ==========
void sendDataToServer() {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("❌ Wi-Fi not connected!");
    return;
  }

  if (client.connect(serverIP, serverPort)) {
    Serial.println("📤 Sending data to server...");

    // Create JSON payload
    String jsonData = "{";
    jsonData += "\"temperature\":" + String(temperature) + ",";
    jsonData += "\"humidity\":" + String(humidity) + ",";
    jsonData += "\"light\":" + String(lightLevel) + ",";
    jsonData += "\"ec\":" + String(ecValue) + ",";
    jsonData += "\"tds\":" + String(tdsValue) + ",";
    jsonData += "\"ph\":" + String(phValue) + ",";
    jsonData += "\"water_level\":" + String(waterLevel);
    jsonData += "}";

    // Send HTTP POST Request
    client.println("POST /api/data HTTP/1.1");
    client.println("Host: " + String(serverIP));
    client.println("Content-Type: application/json");
    client.print("Content-Length: ");
    client.println(jsonData.length());
    client.println("Connection: close");
    client.println();
    client.println(jsonData);

    Serial.println("✅ Data sent successfully!");
    client.stop();
  } else {
    Serial.println("❌ Connection to server failed!");
  }
}