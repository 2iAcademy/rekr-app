import { toast } from 'sonner';
import { failureMessage, type BusinessMessages } from './failureMessage';

export const notifySuccess = (message: string): void => {
  toast.success(message, { duration: 5000 });
};

export const notifyFailure = (cause: unknown, business: BusinessMessages): void => {
  toast.error(failureMessage(cause, business), { duration: 10000 });
};
