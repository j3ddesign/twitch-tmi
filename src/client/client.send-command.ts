import { __ws__ } from './client.connect';
import { formatChannelName } from '../utils/channel';
import { logger } from '../logger';
import { promiseTimeout } from '../utils/promise-timeout';
import { store } from './store';
import { messageQueue$ } from './client';

export function __sendCommand<T>(channel: string, command: string, callback: PromiseCB): Promise<T> {
  return new Promise((resolve, reject) => {
    const latency = store.get('connection').currentLatency;
    const delay = latency <= 600 ? 600 : latency + 100;
    promiseTimeout(delay).then(() => reject("No response from twitch"));

    if (__ws__ !== null && __ws__.readyState !== 2 && __ws__.readyState !== 3) {
      if (channel) {
        logger.info(`[${formatChannelName(channel)}] Executing command: ${command}`);
        messageQueue$.addMessage(`PRIVMSG ${formatChannelName(channel)} :${command}`);
      } else {
        logger.info(`Executing command: ${command}`);
        messageQueue$.addMessage(command);
      }
      callback(resolve, reject);
    } else {
      reject('Not connected to server');
    }
  });
}

export type PromiseCB = (resolve: Function, reject: Function) => void;
