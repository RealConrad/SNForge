import { pageLinkCommand } from '../page-link';

export const fd = pageLinkCommand({
  name: 'fd',
  aliases: ['flow', 'flowdesigner'],
  description: 'Open Flow Designer',
  path: '/now/workflow-studio/home/flow',
});