const channels = new Map();

function noopChannel(event, context) {
  return { channel: 'noop', ok: true, eventId: event.id, contextType: context?.type };
}

const DEFAULT_CHANNELS = ['push', 'vk', 'telegram', 'email', 'activityFeed', 'loki'];

function defaultFactory(name) {
  return async () => ({ ok: true, channel: name, dropped: true });
}

export function registerNotificationChannel(name, handler) {
  if (!name || typeof handler !== 'function') return () => {};
  const normalizedName = String(name).trim();
  channels.set(normalizedName, handler);
  return () => channels.delete(normalizedName);
}

export function unregisterNotificationChannel(name) {
  channels.delete(String(name));
}

export async function runNotificationPipeline(event, context = {}) {
  const activeChannels = Object.keys(context.channels || {}).length
    ? Object.keys(context.channels)
    : DEFAULT_CHANNELS;

  const tasks = activeChannels.map((channelName) => {
    const processor = channels.get(channelName) || defaultFactory(channelName);
    try {
      return Promise.resolve(processor(event, context)).catch(error => ({
        ok: false,
        channel: channelName,
        error: String(error?.message || error || 'pipeline_error'),
      }));
    } catch (error) {
      return Promise.resolve({
        ok: false,
        channel: channelName,
        error: String(error?.message || error || 'pipeline_error'),
      });
    }
  });

  return Promise.all(tasks).then(results => {
    const pipeline = results.map((result, index) => {
      if (result) return result;
      return { channel: activeChannels[index], ok: false, error: 'empty_result' };
    });
    return {
      event,
      results: pipeline,
      ok: pipeline.every(item => item.ok !== false),
    };
  });
}

export function resetNotificationChannels() {
  channels.clear();
}

export async function routeEventThroughPipeline(event, context = {}) {
  return runNotificationPipeline(event, context);
}

export function wireDefaultNotificationPipeline() {
  DEFAULT_CHANNELS.forEach(channelName => {
    if (!channels.has(channelName)) {
      channels.set(channelName, noopChannel);
    }
  });
  return noopChannel;
}
