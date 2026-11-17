import { pageLinkCommand } from '../page-link';

export const fd = pageLinkCommand({
  name: 'fd',
  aliases: ['flow', 'flowdesigner'],
  description: 'Open Flow Designer in a new tab',
  path: '/now/workflow-studio/home/flow',
});