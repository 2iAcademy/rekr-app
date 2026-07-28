export type LogLevel =
  'Debug' | 'Information' | 'Warning' | 'Error' | 'Critical';

export interface KafkaLogEvent {
  eventId: string;
  occurredAt: string;
  level: LogLevel;
  service: string;
  message: string;
  logger: string | null;
  traceId: string | null;
  spanId: string | null;
  userId: string | null;
  payload: Record<string, unknown>;
}

export function createSampleLogEvent(): KafkaLogEvent {
  return {
    eventId: crypto.randomUUID(),
    occurredAt: new Date().toISOString(),
    level: 'Information',
    service: 'backend',
    message: 'Sample application log emitted to Kafka',
    logger: 'LogsController',
    traceId: null,
    spanId: null,
    userId: null,
    payload: {
      route: '/api/logs/sample',
      method: 'POST',
    },
  };
}

export function createErrorLogEvent(message: string): KafkaLogEvent {
  return {
    eventId: crypto.randomUUID(),
    occurredAt: new Date().toISOString(),
    level: 'Error',
    service: 'backend',
    message,
    logger: 'LogsController',
    traceId: null,
    spanId: null,
    userId: null,
    payload: {
      route: '/api/logs/error',
      method: 'POST',
      simulated: true,
    },
  };
}
