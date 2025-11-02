import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class AppGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  handleConnection(client: Socket, ...args: any[]) {
    console.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    console.log(`Client disconnected: ${client.id}`);
  }
  
  /**
   * Gửi kết quả nhận diện cho React UI
   * @param result Dữ liệu log từ AccessLogs
   */
  notifyUi(result: any) {
    console.log('Notifying UI...');
    this.server.emit('recognition_result', result); 
    // React sẽ lắng nghe sự kiện 'recognition_result'
  }

  /**
   * Gửi lệnh mở cửa cho ESP32-Receiver
   * @param command Lệnh (ví dụ: { "command": "OPEN_DOOR" })
   */
  sendCommandToDevice(command: any) {
    console.log('Sending command to device...');
    this.server.emit('device_command', command); 
    // ESP32-Receiver sẽ lắng nghe sự kiện 'device_command'
  }
}