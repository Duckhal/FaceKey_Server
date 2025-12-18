import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
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
   * === 1. THÊM HÀM NÀY ===
   * Cho phép App/Device tham gia vào "phòng riêng" của User
   * Client sẽ gửi event 'join_room' kèm userId
   */
  @SubscribeMessage('join_room')
  handleJoinRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() userId: string | number,
  ) {
    const roomName = `user_${userId}`;
    client.join(roomName);
    console.log(`Client ${client.id} joined room: ${roomName}`);
  }

  /**
   * Gửi kết quả nhận diện cho React UI
   * === 2. SỬA THAM SỐ: Thêm userId ===
   */
  notifyUi(userId: number, result: any) {
    if (!userId) {
      console.warn(
        'notifyUi called without userId, broadcasting to all (fallback)',
      );
      this.server.emit('recognition_result', result);
      return;
    }

    const roomName = `user_${userId}`;
    console.log(`Notifying UI in room ${roomName}...`);

    // Chỉ gửi cho các client trong phòng user_1, user_2...
    this.server.to(roomName).emit('recognition_result', result);
  }

  /**
   * Gửi lệnh mở cửa cho ESP32-Receiver
   * === 3. SỬA THAM SỐ: Thêm userId ===
   */
  sendCommandToDevice(userId: number, command: any) {
    if (!userId) {
      this.server.emit('device_command', command);
      return;
    }

    const roomName = `user_${userId}`;
    console.log(`Sending command to device in room ${roomName}...`);

    // Chỉ gửi lệnh cho thiết bị thuộc về user này
    this.server.to(roomName).emit('device_command', command);
  }
}
