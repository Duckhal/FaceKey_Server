#include <Arduino.h>
#include <WiFi.h>
#include <PubSubClient.h>
#include <ESP32Servo.h>

const char *ssid = "Galaxy A53 5G 5CC2";
const char *password = "oysl4029";

const char *mqtt_server = "broker.hivemq.com";
const int mqtt_port = 1883;

#define SERVO_PIN 13

Servo myServo;
WiFiClient espClient;
PubSubClient client(espClient);
String device_uid = "";
String topic_command = "";

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

  // Kiểm tra lệnh
  if (msg == "OPEN_DOOR")
  {
    Serial.println(">>> LỆNH: MỞ CỬA MQTT");
    myServo.write(90);
    // Dùng millis để tránh delay chặn kết nối MQTT
    delay(2000);
    myServo.write(0);
    Serial.println(">>> Đã đóng cửa");
  }
}

void reconnect()
{
  // Lặp cho đến khi kết nối lại được
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

  // Setup Servo
  myServo.setPeriodHertz(50);
  myServo.attach(SERVO_PIN, 500, 2400);
  myServo.write(0);

  setup_wifi();

  // Tạo topic dựa trên MAC Address
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