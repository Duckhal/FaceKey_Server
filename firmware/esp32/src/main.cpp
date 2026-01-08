#include <Arduino.h>
#include <WiFi.h>
#include <PubSubClient.h>
#include <ESP32Servo.h>

const char *ssid = "Galaxy A53 5G 5CC2";
const char *password = "oysl4029";
const char *mqtt_server = "broker.hivemq.com";
const int mqtt_port = 1883;

WiFiClient espClient;
PubSubClient client(espClient);
String device_uid = "";
String topic_command = "";

void controlDoor(int pin)
{
  Serial.print("Đang điều khiển Cửa ở chân GPIO: ");
  Serial.println(pin);

  Servo dynamicServo;
  dynamicServo.setPeriodHertz(50);
  dynamicServo.attach(pin, 500, 2400);

  // Mở
  dynamicServo.write(90);
  delay(2000);

  // Đóng
  dynamicServo.write(0);
  delay(500);
  dynamicServo.detach();

  Serial.println("Đã đóng cửa và ngắt Servo.");
}

void callback(char *topic, byte *payload, unsigned int length)
{
  Serial.print("Message arrived [");
  Serial.print(topic);
  Serial.print("] ");

  String msg = "";
  for (unsigned int i = 0; i < length; i++)
  {
    msg += (char)payload[i];
  }
  Serial.println(msg);

  // 1. Tìm vị trí dấu hai chấm ":"
  int colonIndex = msg.indexOf(':');

  if (colonIndex != -1)
  {
    // 2. Tách chuỗi
    String pinStr = msg.substring(0, colonIndex);
    String command = msg.substring(colonIndex + 1);

    // 3. Chuyển Pin sang số nguyên
    int pin = pinStr.toInt();

    // 4. Kiểm tra lệnh
    if (command == "OPEN_DOOR")
    {
      if (pin > 0)
      {
        controlDoor(pin);
      }
      else
      {
        Serial.println("Lỗi: Số Pin không hợp lệ!");
      }
    }
    else
    {
      Serial.println("Lỗi: Lệnh không xác định!");
    }
  }
  else
  {
    if (msg == "OPEN_DOOR")
    {
      controlDoor(13);
    }
  }
}

void setup_wifi()
{
  delay(10);
  Serial.println();
  Serial.print("Connecting to ");
  Serial.println(ssid);
  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED)
  {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\nWiFi connected");
}

void reconnect()
{
  while (!client.connected())
  {
    Serial.print("Attempting MQTT connection...");
    String clientId = "ESP32Client-";
    clientId += device_uid;

    if (client.connect(clientId.c_str()))
    {
      Serial.println("connected");
      client.subscribe(topic_command.c_str());
      Serial.print("Subscribed to: ");
      Serial.println(topic_command);
    }
    else
    {
      Serial.print("failed, rc=");
      Serial.print(client.state());
      Serial.println(" try again in 5 seconds");
      delay(5000);
    }
  }
}

void setup()
{
  Serial.begin(115200);
  setup_wifi();

  device_uid = WiFi.macAddress();
  topic_command = "device/" + device_uid + "/command";

  client.setServer(mqtt_server, mqtt_port);
  client.setCallback(callback);

  Serial.print("DEVICE ID: ");
  Serial.println(device_uid);
  Serial.print("LISTENING ON TOPIC: ");
  Serial.println(topic_command);
}

void loop()
{
  if (!client.connected())
  {
    reconnect();
  }
  client.loop();
}