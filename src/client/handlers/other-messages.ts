import { ParsedMessage } from '../../parser/message';
import { noop } from '../../utils/noop';
import { __event$__ } from '../client';
import { isJustinfan } from '../../utils/type-checks';
import { Subject } from 'rxjs/Subject';
import { ClientEventMap, UserState } from '../event-types';
import { logger } from '../../logger';
import { buildEvent } from '../../utils/build-event';
import { setChannels, setLastJoinedChannel } from '../../state/core/core.actions';
import { addChannel, removeChannel, setUserState } from '../../state/channel/channel.actions';
import { extractNumber } from '../../utils/extract-number';
import { store } from '../store';

export function handleOtherMessages(message: ParsedMessage, event$: Subject<any>) {
  const commands = {
    "353" : () => {
      __event$__.next(buildEvent('names', {
        channel: message.params[2],
        names: message.params[3].split(' ')
      }, message.raw));
    },
    "JOIN": () => {
      if (isJustinfan(store.get('core').username) && store.get('core').username === message.prefix.split("!")[0]) {
        // Joined the channel as a justinfan user
        logger.info(`Joined ${message.channel}`);
        store.dispatch('core', setLastJoinedChannel(message.channel));
        store.dispatch('channel', addChannel(message.channel));
        __event$__.next(buildEvent('join', {
          channel: message.channel,
          username: message.prefix.split('!')[0],
          self: true
        }, message.raw));

      }

      if (store.get('core').username !== message.prefix.split("!")[0]) {
        // Someone else joined the channel, just emit the join event..
        logger.info(`${message.prefix.split("!")[0]} Joined ${message.channel}`);
        __event$__.next(buildEvent('join', {
          channel: message.channel,
          username: message.prefix.split('!')[0],
          self: false
        }, message.raw));
      }
    },
    "PART": () => {
      let isSelf = false;
      if (store.get('core').username === message.prefix.split('!')[0]) {
        isSelf = true;
        if (store.get('channel')[message.channel].userstate) { store.dispatch('channel', setUserState(message.channel, {})); }

        store.dispatch('channel', removeChannel(message.channel));

        const coreStore = store.get('core');
        let idx = coreStore.options.channels.indexOf(message.channel);
        if (idx !== -1) { store.dispatch('core', setChannels(coreStore.channels.filter(channel => channel !== message.channel))); }

        logger.info(`Left ${message.channel}`);
        __event$__.next(buildEvent('_promisePart', {}, message.raw));
      }

      __event$__.next(buildEvent('part', {
        channel: message.channel,
        username: message.prefix.split('!')[0],
        self: isSelf
      }, message.raw));
    },
    "WHISPER": () => {},
    "PRIVMSG": () => {
      // Add username (lowercase) to the tags..
      message.tags['username'] = message.prefix.split("!")[0];

      if (message.tags['username'] === "jtv") {
        // Message from JTV..

        if (message.content.includes("hosting you for")) {
          // Someone is hosting the channel and the message contains how many viewers..
          const count = extractNumber(message.content);

          __event$__.next(buildEvent('hosted', {
            username: message.content.split(' ')[0],
            channel: message.channel,
            viewers: count,
            autohost: message.content.includes('auto')
          }, message.raw));

        } else if (message.content.includes("hosting you")) {
          // Some is hosting the channel, but no viewer(s) count provided in the message..
          __event$__.next(buildEvent('hosted', {
            username: message.content.split(' ')[0],
            channel: message.channel,
            viewers: 0,
            autohost: message.content.includes('auto')
          }, message.raw));
        }
      } else {
        // Message is an action (/me <message>)..

        if (message.content.match(/^\u0001ACTION ([^\u0001]+)\u0001$/)) {
          message.tags["message-type"] = "action";

          __event$__.next(buildEvent('action',  {
            channel: message.channel,
            userstate: message.tags as UserState,
            message: message.content.match(/^\u0001ACTION ([^\u0001]+)\u0001$/)[1],
            self: false
          }, message.raw));
          __event$__.next(buildEvent('message',  {
            channel: message.channel,
            userstate: message.tags as UserState,
            message: message.content.match(/^\u0001ACTION ([^\u0001]+)\u0001$/)[1],
            self: false
          }, message.raw));

        } else {
          if (message.tags.hasOwnProperty("bits")) {
            // Message is a cheer
            __event$__.next(buildEvent('cheer',  {
              channel: message.channel,
              userstate: message.tags as UserState,
              message: message.content
            }, message.raw));

          } else {
            // Message is a regular chat message..
            message.tags["message-type"] = "chat";
            logger.info(`[${message.channel}] <${message.tags['username']}>: ${message.content}`);

            __event$__.next(buildEvent('chat',  {
              channel: message.channel,
              userstate: message.tags as UserState,
              message: message.content,
              self: false
            }, message.raw));
            __event$__.next(buildEvent('message',  {
              channel: message.channel,
              userstate: message.tags as UserState,
              message: message.content,
              self: false
            }, message.raw));
          }
        }
      }
    }
  };
  commands[message.command] ? commands[message.command]() : noop();
}
