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
import * as mqtt from 'mqtt';

@WebSocketGateway({
  cors: { origin: '*' },
  transports: ['websocket'],
})
export class AppGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private mqttClient: mqtt.MqttClient;

  constructor() {
    this.mqttClient = mqtt.connect('mqtt://broker.hivemq.com:1883');

    this.mqttClient.on('connect', () => {
      console.log('NestJS Connected to Local MQTT Broker');
    });

    this.mqttClient.on('error', (err) => {
      console.error('MQTT Error:', err);
    });
  }

  handleConnection(client: Socket) {
    console.log(`App Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    console.log(`App Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('join_room')
  handleJoinRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() userId: string | number,
  ) {
    const roomName = `user_${userId}`;
    client.join(roomName);
    console.log(`App joined room: ${roomName}`);
  }

  // Gửi lệnh xuống ESP32 qua MQTT
  sendCommandToDevice(userId: number, payload: any) {
    const targetDeviceUid = payload.from_device;
    const topic = `device/${targetDeviceUid}/command`;
    const message = payload.command;

    console.log(`📡 MQTT Publish to [${topic}]: ${message}`);
    this.mqttClient.publish(topic, message);
  }

  notifyUi(userId: number, result: any) {
    const roomName = `user_${userId}`;
    if (this.server) {
      this.server.to(roomName).emit('recognition_result', result);
    } else {
      console.error('Socket Server is not initialized!');
    }
  }
}
