#include <Arduino.h>
#include <WiFi.h>
#include "esp_camera.h"
#include "HTTPClient.h"

const char *ssid = "Galaxy A53 5G 5CC2";
const char *password = "oysl4029";

const char *server_ip = "192.168.34.16";
const int server_port = 3000;
const char *server_endpoint = "/api/recognition/recognize";

#include "board_config.h"

void setupCamera()
{
  camera_config_t config;
  config.ledc_channel = LEDC_CHANNEL_0;
  config.ledc_timer = LEDC_TIMER_0;
  config.pin_d0 = Y2_GPIO_NUM;
  config.pin_d1 = Y3_GPIO_NUM;
  config.pin_d2 = Y4_GPIO_NUM;
  config.pin_d3 = Y5_GPIO_NUM;
  config.pin_d4 = Y6_GPIO_NUM;
  config.pin_d5 = Y7_GPIO_NUM;
  config.pin_d6 = Y8_GPIO_NUM;
  config.pin_d7 = Y9_GPIO_NUM;
  config.pin_xclk = XCLK_GPIO_NUM;
  config.pin_pclk = PCLK_GPIO_NUM;
  config.pin_vsync = VSYNC_GPIO_NUM;
  config.pin_href = HREF_GPIO_NUM;
  config.pin_sccb_sda = SIOD_GPIO_NUM;
  config.pin_sccb_scl = SIOC_GPIO_NUM;
  config.pin_pwdn = PWDN_GPIO_NUM;
  config.pin_reset = RESET_GPIO_NUM;
  config.xclk_freq_hz = 20000000;
  config.pixel_format = PIXFORMAT_JPEG;

  if (psramFound())
  {
    Serial.println("PSRAM đã tìm thấy! Dùng UXGA.");
    config.frame_size = FRAMESIZE_UXGA;
    config.jpeg_quality = 10;
    config.fb_count = 2;
    config.fb_location = CAMERA_FB_IN_PSRAM;
    config.grab_mode = CAMERA_GRAB_LATEST;
  }
  else
  {
    Serial.println("Không tìm thấy PSRAM! Dùng HD.");
    config.frame_size = FRAMESIZE_HD; // (1280x720)
    config.jpeg_quality = 12;
    config.fb_count = 1;
    config.fb_location = CAMERA_FB_IN_DRAM;
  }

  // Khởi tạo camera
  esp_err_t err = esp_camera_init(&config);
  if (err != ESP_OK)
  {
    Serial.printf("Khởi tạo camera thất bại! Lỗi 0x%x", err);
    delay(5000);
    ESP.restart();
    return;
  }
  Serial.println("Khởi tạo camera thành công.");
}

// Hàm khởi tạo WiFi
void setupWifi()
{
  WiFi.begin(ssid, password);
  Serial.print("Đang kết nối Wi-Fi...");
  while (WiFi.status() != WL_CONNECTED)
  {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\nĐã kết nối Wi-Fi!");
  Serial.print("Địa chỉ IP: ");
  Serial.println(WiFi.localIP());
}

void sendPhoto()
{
  Serial.println("Đang chụp ảnh...");
  camera_fb_t *fb = NULL;

  fb = esp_camera_fb_get();
  if (!fb)
  {
    Serial.println("Chụp ảnh thất bại (Camera capture failed)");
    return;
  }
  Serial.printf("Chụp ảnh thành công. Kích thước: %u bytes\n", fb->len);

  String macAddr = WiFi.macAddress();

  String boundary = "----WebKitFormBoundary7MA4YWxkTrZu0gW";
  String body_start = "--" + boundary + "\r\n";
  body_start += "Content-Disposition: form-data; name=\"file\"; filename=\"image.jpg\"\r\n";
  body_start += "Content-Type: image/jpeg\r\n\r\n";

  String body_end = "\r\n--" + boundary + "--\r\n";

  size_t total_len = body_start.length() + fb->len + body_end.length();

  WiFiClient client;

  Serial.print("Đang kết nối tới server: ");
  Serial.print(server_ip);
  Serial.print(":");
  Serial.println(server_port);

  if (!client.connect(server_ip, server_port))
  {
    Serial.println("Kết nối thất bại!");
    esp_camera_fb_return(fb);
    return;
  }
  Serial.println("Đã kết nối. Đang gửi request...");

  client.print(String("POST ") + server_endpoint + " HTTP/1.1\r\n");
  client.print(String("Host: ") + server_ip + "\r\n");
  client.print(String("x-device-uid: ") + macAddr + "\r\n");
  client.print("Connection: close\r\n");
  client.print(String("Content-Length: ") + total_len + "\r\n");
  client.print(String("Content-Type: multipart/form-data; boundary=") + boundary + "\r\n");
  client.print("\r\n");

  client.print(body_start);

  // Phần 2: Gửi dữ liệu ảnh (fb->buf)
  size_t buff_len = fb->len;
  uint8_t *buff_ptr = fb->buf;
  size_t chunk_size = 1024;
  while (buff_len > 0)
  {
    size_t len_to_write = (buff_len < chunk_size) ? buff_len : chunk_size;
    client.write(buff_ptr, len_to_write);
    buff_ptr += len_to_write;
    buff_len -= len_to_write;
    delay(1);
  }

  // Phần 3: Gửi "body_end"
  client.print(body_end);

  Serial.println("Gửi ảnh hoàn tất. Đang chờ phản hồi...");

  // 6. Đọc phản hồi từ Server
  String response = "";
  long timeout = millis();
  while (client.connected() || client.available())
  {
    if (client.available())
    {
      char c = client.read();
      response += c;
      timeout = millis(); // Reset timeout khi có dữ liệu
    }
    // Timeout sau 5 giây nếu server không trả lời
    if (millis() - timeout > 5000)
    {
      Serial.println("Client timeout!");
      break;
    }
  }
  // client.stop(); // Ngắt kết nối
  // Serial.println("Đã ngắt kết nối.");
  // Serial.println("--- Phản hồi từ Server ---");
  // Serial.println(response);
  // Serial.println("--------------------------");

  // 7. Dọn dẹp
  esp_camera_fb_return(fb);
}

// HÀM SETUP CHÍNH
void setup()
{
  Serial.begin(115200);
  Serial.setDebugOutput(true);
  Serial.println("Khởi động ESP32-CAM (HTTP POST Client)...");

  setupWifi();
  Serial.print("DEVICE MAC ADDRESS: ");
  Serial.println(WiFi.macAddress());
  Serial.println("Hãy dùng mã này để đăng ký trong App.");
  setupCamera();

  Serial.println("Thực hiện 1 lần chụp nháp để 'làm nóng' camera...");
  camera_fb_t *fb_dummy = esp_camera_fb_get();
  if (fb_dummy)
  {
    esp_camera_fb_return(fb_dummy);
  }

  Serial.println("Thiết lập hoàn tất.");
}

// HÀM LOOP CHÍNH
void loop()
{
  Serial.println("Chờ 3 giây trước khi gửi ảnh tiếp theo...");
  delay(5000);
  sendPhoto();
}