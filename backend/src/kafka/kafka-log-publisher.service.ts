import { Injectable, OnApplicationShutdown } from '@nestjs/common';
import { Kafka, Producer } from 'kafkajs';
import { KafkaLogEvent } from './log-event';

@Injectable()
export class KafkaLogPublisherService implements OnApplicationShutdown {
  private readonly kafka: Kafka;
  private readonly topic: string;
  private producer: Producer | null = null;

  constructor() {
    const brokers = (process.env.KAFKA_BOOTSTRAP_SERVERS ?? 'localhost:29092')
      .split(',')
      .map((broker) => broker.trim())
      .filter(Boolean);

    this.topic = process.env.KAFKA_TOPIC ?? 'logs.raw';
    this.kafka = new Kafka({
      clientId: process.env.KAFKA_CLIENT_ID ?? 'rekr-backend',
      brokers,
    });
  }

  get topicName(): string {
    return this.topic;
  }

  async publish(event: KafkaLogEvent) {
    try {
      const producer = await this.getProducer();

      console.log('Publishing to topic:', this.topic);
      console.log(event);

      const result = await producer.send({
        topic: this.topic,
        messages: [
          {
            key: event.eventId,
            value: JSON.stringify(event),
          },
        ],
      });

      console.log('Kafka send result:', result);

      return result;
    } catch (err) {
      console.error('Kafka publish failed:', err);
      throw err;
    }
  }

  async onApplicationShutdown() {
    if (this.producer) {
      await this.producer.disconnect();
      this.producer = null;
    }
  }

  private async getProducer(): Promise<Producer> {
    if (!this.producer) {
      this.producer = this.kafka.producer({
        allowAutoTopicCreation: true,
      });
      await this.producer.connect();
    }

    return this.producer;
  }
}
