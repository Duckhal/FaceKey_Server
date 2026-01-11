#include <Arduino.h>
#include <WiFi.h>
#include <PubSubClient.h>
#include <ESP32Servo.h>
#include <WiFiManager.h>

// CẤU HÌNH WIFI CỨNG (ƯU TIÊN KẾT NỐI TRƯỚC)
const char *ssid_fix = "GalaxyA53";
const char *pass_fix = "oysl4029";

// Cấu hình MQTT
const char *mqtt_server = "broker.hivemq.com";
const int mqtt_port = 1883;

// Khai báo đối tượng
WiFiClient espClient;
PubSubClient client(espClient);
String device_uid = "";
String topic_command = "";
WiFiManager wifiManager;

// Nút nhấn để reset cài đặt WiFi (Nút BOOT GPIO 0)
const int TRIGGER_PIN = 0;

// HÀM ĐIỀU KHIỂN SERVO
void controlServo(int pin)
{
  Serial.print("-> Kích hoạt SERVO tại GPIO: ");
  Serial.println(pin);
  Servo dynamicServo;
  dynamicServo.setPeriodHertz(50);
  dynamicServo.attach(pin, 500, 2400);
  Serial.println("   Servo: Mở (90 độ)");
  dynamicServo.write(90);
  delay(2000);
  Serial.println("   Servo: Đóng (0 độ)");
  dynamicServo.write(0);
  delay(500);
  dynamicServo.detach();
  Serial.println("   Servo: Hoàn tất.");
}

// HÀM ĐIỀU KHIỂN RELAY
void controlRelay(int pin)
{
  Serial.print("-> Kích hoạt RELAY tại GPIO: ");
  Serial.println(pin);
  pinMode(pin, OUTPUT);
  digitalWrite(pin, HIGH);
  Serial.println("   Relay: BẬT (Rút chốt)");
  delay(3000);
  digitalWrite(pin, LOW);
  Serial.println("   Relay: TẮT (Nhả chốt)");
}

// HÀM XỬ LÝ TIN NHẮN MQTT
void callback(char *topic, byte *payload, unsigned int length)
{
  String msg = "";
  for (unsigned int i = 0; i < length; i++)
    msg += (char)payload[i];

  Serial.print("Nhận lệnh MQTT: [");
  Serial.print(topic);
  Serial.print("] ");
  Serial.println(msg);

  int colonIndex = msg.indexOf(':');
  if (colonIndex != -1)
  {
    String pinStr = msg.substring(0, colonIndex);
    String command = msg.substring(colonIndex + 1);
    int pin = pinStr.toInt();

    if (command == "OPEN_DOOR" && pin > 0)
    {
      if (pin == 13 || pin == 12 || pin == 14) // Chân 13, 12, 14 dùng Servo
        controlServo(pin);
      else
        controlRelay(pin); // Mặc định các chân khác là Relay
    }
  }
  else
  {
    if (msg == "OPEN_DOOR")
      controlServo(13); // Lệnh cũ
  }
}

// HÀM KẾT NỐI MQTT
void reconnect()
{
  while (!client.connected())
  {
    Serial.print("Đang kết nối MQTT...");
    String clientId = "ESP32Client-" + device_uid;
    if (client.connect(clientId.c_str()))
    {
      Serial.println("Đã kết nối!");
      client.subscribe(topic_command.c_str());
      Serial.println("Đã đăng ký topic: " + topic_command);
    }
    else
    {
      Serial.print("Lỗi, rc=");
      Serial.print(client.state());
      Serial.println(" thử lại sau 5s");
      delay(5000);
    }
  }
}

// HÀM CHECK NÚT RESET WIFI
void checkResetButton()
{
  if (digitalRead(TRIGGER_PIN) == LOW)
  {
    Serial.println("\nNút BOOT đang được nhấn...");
    delay(1000);
    int holdTime = 0;
    while (digitalRead(TRIGGER_PIN) == LOW)
    {
      delay(100);
      holdTime += 100;
      if (holdTime > 3000)
        break;
    }
    if (holdTime > 3000)
    {
      Serial.println("Đang xóa cài đặt WiFi...");
      wifiManager.resetSettings();
      ESP.restart();
    }
  }
}

void setup()
{
  Serial.begin(115200);
  pinMode(TRIGGER_PIN, INPUT_PULLUP);

  // BƯỚC 1: THỬ KẾT NỐI WIFI CỨNG (HARDCODED) TRƯỚC
  Serial.println("\nBắt đầu khởi động");
  Serial.print("Đang thử kết nối WiFi ưu tiên: ");
  Serial.println(ssid_fix);

  WiFi.mode(WIFI_STA); // Chế độ Station
  WiFi.begin(ssid_fix, pass_fix);

  // Chờ tối đa 10 giây xem có kết nối được Hardcoded không
  int timeout = 0;
  while (WiFi.status() != WL_CONNECTED && timeout < 20)
  {
    delay(500);
    Serial.print(".");
    timeout++;
  }

  // BƯỚC 2: KIỂM TRA KẾT QUẢ
  if (WiFi.status() == WL_CONNECTED)
  {
    Serial.println("\n>> Đã kết nối thành công với WiFi Ưu tiên!");
    Serial.print("IP Address: ");
    Serial.println(WiFi.localIP());
  }
  else
  {
    // Nếu Hardcoded thất bại -> Dùng WiFiManager
    Serial.println("\n>> WiFi Ưu tiên thất bại. Chuyển sang chế độ WiFi Manager...");

    // Tùy chỉnh timeout cho portal (nếu không ai nhập pass sau 3 phút thì reset thử lại)
    wifiManager.setConfigPortalTimeout(180);

    // autoConnect sẽ thử các WiFi đã lưu trong Flash trước.
    // Nếu không được mới phát ra AP tên "ESP32_SmartLock"
    bool res = wifiManager.autoConnect("ESP32_SmartLock", "12345678");

    if (!res)
    {
      Serial.println("Không kết nối được WiFi nào cả. Khởi động lại...");
      ESP.restart();
    }
    else
    {
      Serial.println("\n>> Đã kết nối WiFi qua cấu hình Web!");
      Serial.print("IP Address: ");
      Serial.println(WiFi.localIP());
    }
  }

  // CẤU HÌNH MQTT
  device_uid = WiFi.macAddress();
  topic_command = "device/" + device_uid + "/command";
  client.setServer(mqtt_server, mqtt_port);
  client.setCallback(callback);

  Serial.print("DEVICE ID: ");
  Serial.println(device_uid);
}

void loop()
{
  checkResetButton();
  if (!client.connected())
    reconnect();
  client.loop();
}