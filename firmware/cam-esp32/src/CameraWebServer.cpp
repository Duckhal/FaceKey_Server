#include <Arduino.h>
#include <WiFi.h>
#include "esp_camera.h"
#include "HTTPClient.h"
#include <WiFiManager.h> // Thư viện quản lý WiFi
#include <Preferences.h> // Thư viện lưu trữ dữ liệu vào bộ nhớ Flash

// CẤU HÌNH WIFI CỨNG (HARDCODED)
const char *ssid_fix = "GalaxyA53";
const char *pass_fix = "oysl4029";

// CẤU HÌNH SERVER MẶC ĐỊNH
char server_ip[40] = "192.168.1.10"; // Giá trị mặc định nếu chưa cài đặt
const int server_port = 3000;
const char *server_endpoint = "/api/recognition/recognize";

// Khai báo đối tượng
Preferences preferences;       // Để lưu IP vào bộ nhớ
bool shouldSaveConfig = false; // Cờ kiểm tra xem có cần lưu cấu hình không

#include "board_config.h" // File chứa định nghĩa chân camera (AI THINKER)

// CẤU HÌNH CALLBACK KHI NGƯỜI DÙNG BẤM LƯU CẤU HÌNH
void saveConfigCallback()
{
  Serial.println("Phát hiện thay đổi cấu hình -> Cần lưu lại");
  shouldSaveConfig = true;
}

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
    config.frame_size = FRAMESIZE_UXGA;
    config.jpeg_quality = 10;
    config.fb_count = 2;
    config.fb_location = CAMERA_FB_IN_PSRAM;
    config.grab_mode = CAMERA_GRAB_LATEST;
  }
  else
  {
    config.frame_size = FRAMESIZE_HD;
    config.jpeg_quality = 12;
    config.fb_count = 1;
    config.fb_location = CAMERA_FB_IN_DRAM;
  }

  esp_err_t err = esp_camera_init(&config);
  if (err != ESP_OK)
  {
    Serial.printf("Camera Init Failed Error 0x%x", err);
    delay(5000);
    ESP.restart();
  }
}

void sendPhoto()
{
  Serial.println("\n--- Bắt đầu quy trình gửi ảnh ---");

  // 1. Chụp ảnh
  camera_fb_t *fb = esp_camera_fb_get();
  if (!fb)
  {
    Serial.println("Lỗi: Không chụp được ảnh");
    return;
  }
  Serial.printf("Chụp thành công: %u bytes\n", fb->len);

  // 2. Chuẩn bị Header Multipart
  String macAddr = WiFi.macAddress();
  String boundary = "----WebKitFormBoundary7MA4YWxkTrZu0gW";
  String body_start = "--" + boundary + "\r\n";
  body_start += "Content-Disposition: form-data; name=\"file\"; filename=\"image.jpg\"\r\n";
  body_start += "Content-Type: image/jpeg\r\n\r\n";
  String body_end = "\r\n--" + boundary + "--\r\n";

  size_t total_len = body_start.length() + fb->len + body_end.length();

  // 3. Kết nối Server
  WiFiClient client;
  Serial.print("Đang kết nối tới Server IP: ");
  Serial.print(server_ip); // Sử dụng biến dynamic IP
  Serial.print(" : ");
  Serial.println(server_port);

  if (!client.connect(server_ip, server_port))
  {
    Serial.println("Kết nối Server thất bại! Kiểm tra IP hoặc Firewall.");
    esp_camera_fb_return(fb);
    return;
  }

  // 4. Gửi Request
  client.print(String("POST ") + server_endpoint + " HTTP/1.1\r\n");
  client.print(String("Host: ") + server_ip + "\r\n");
  client.print(String("x-device-uid: ") + macAddr + "\r\n");
  client.print("Connection: close\r\n");
  client.print(String("Content-Length: ") + total_len + "\r\n");
  client.print(String("Content-Type: multipart/form-data; boundary=") + boundary + "\r\n");
  client.print("\r\n");

  client.print(body_start);

  // Gửi binary ảnh theo chunk
  size_t buff_len = fb->len;
  uint8_t *buff_ptr = fb->buf;
  size_t chunk_size = 1024;
  while (buff_len > 0)
  {
    size_t len_to_write = (buff_len < chunk_size) ? buff_len : chunk_size;
    client.write(buff_ptr, len_to_write);
    buff_ptr += len_to_write;
    buff_len -= len_to_write;
  }

  client.print(body_end);
  Serial.println("Đã gửi dữ liệu. Đang chờ phản hồi...");

  // 5. Đọc phản hồi
  long timeout = millis();
  while (client.connected() || client.available())
  {
    if (client.available())
    {
      String line = client.readStringUntil('\n');
      // In ra phản hồi để debug nếu cần
      // Serial.println(line);
      timeout = millis();
    }
    if (millis() - timeout > 5000)
    {
      Serial.println("Timeout khi chờ phản hồi!");
      break;
    }
  }

  client.stop();
  esp_camera_fb_return(fb);
  Serial.println("Hoàn tất gửi ảnh.");
}

void setup()
{
  Serial.begin(115200);
  Serial.setDebugOutput(true);
  Serial.println("\nKhởi động ESP32-CAM...");

  // 1. LẤY IP SERVER TỪ BỘ NHỚ
  preferences.begin("cam_config", false); // Mở namespace "cam_config"
  String saved_ip = preferences.getString("server_ip", "");

  if (saved_ip.length() > 0)
  {
    Serial.print("Đã tìm thấy IP Server đã lưu: ");
    Serial.println(saved_ip);
    saved_ip.toCharArray(server_ip, 40); // Copy vào biến toàn cục
  }
  else
  {
    Serial.println("Chưa có IP Server lưu, dùng mặc định.");
  }

  // 2. THỬ KẾT NỐI WIFI CỨNG TRƯỚC
  Serial.print("Đang thử kết nối WiFi ưu tiên: ");
  Serial.println(ssid_fix);
  WiFi.mode(WIFI_STA);
  WiFi.begin(ssid_fix, pass_fix);

  int retry = 0;
  bool hardcoded_success = false;
  while (retry < 20)
  { // Thử khoảng 10 giây
    if (WiFi.status() == WL_CONNECTED)
    {
      hardcoded_success = true;
      break;
    }
    delay(500);
    Serial.print(".");
    retry++;
  }

  // 3. NẾU THẤT BẠI -> DÙNG WIFI MANAGER
  if (hardcoded_success)
  {
    Serial.println("\n>> Kết nối thành công WiFi cứng!");
  }
  else
  {
    Serial.println("\n>> Kết nối WiFi cứng thất bại. Chuyển sang WiFi Manager AP...");

    WiFiManager wm;
    wm.setSaveConfigCallback(saveConfigCallback); // Đăng ký hàm callback

    // TẠO Ô NHẬP LIỆU CHO IP SERVER
    // id, label, default value, length
    WiFiManagerParameter custom_server_ip("server_ip", "Server IP Address (Backend)", server_ip, 40);
    wm.addParameter(&custom_server_ip);

    // Tự động kết nối hoặc tạo AP tên "ESP32_CAM_Config"
    // IP mặc định của trang cấu hình: 192.168.4.1
    if (!wm.autoConnect("ESP32_CAM_Config", "12345678"))
    {
      Serial.println("Lỗi kết nối hoặc timeout.");
      ESP.restart();
    }

    // 4. LƯU CẤU HÌNH MỚI NẾU CÓ
    Serial.println("\n>> Đã kết nối WiFi qua Portal!");

    // Đọc giá trị từ ô nhập liệu
    strcpy(server_ip, custom_server_ip.getValue());

    if (shouldSaveConfig)
    {
      Serial.print("Đang lưu IP Server mới vào Flash: ");
      Serial.println(server_ip);
      preferences.putString("server_ip", server_ip);
    }
  }

  preferences.end(); // Đóng preferences

  Serial.print("IP ESP32-CAM: ");
  Serial.println(WiFi.localIP());
  Serial.print("BACKEND IP HIỆN TẠI: ");
  Serial.println(server_ip);

  // 5. KHỞI TẠO CAMERA
  setupCamera();

  // Chụp nháp
  camera_fb_t *fb = esp_camera_fb_get();
  if (fb)
    esp_camera_fb_return(fb);
}

void loop()
{
  // Gửi ảnh mỗi 5 giây
  delay(5000);
  sendPhoto();
}