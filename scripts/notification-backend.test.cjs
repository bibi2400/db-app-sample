const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  NotificationService,
} = require('../packages/framework/dist/electron/services/system-services/notification.service');
const {
  ErrorNotificationService,
} = require('../packages/framework/dist/electron/services/system-services/error-notification.service');
const { Logger } = require('../packages/framework/dist/electron/helpers/logger');

// Keep these isolated service tests from writing application logs.
for (const level of ['debug', 'info', 'warn', 'error']) {
  Logger[level] = () => {};
}

function createService() {
  const received = [];
  const service = new NotificationService({
    initializeChannel(instance) {
      instance.show._initialize(notification => received.push(notification));
    },
  });
  return { service, received };
}

test('backend error forwards legacy dedupId through the startup queue', () => {
  const { service, received } = createService();
  service.error('Errore', 'Messaggio', 'error', 'same-operation');
  assert.equal(received.length, 0);
  service.enable();
  assert.equal(received.length, 1);
  assert.equal(received[0].dedupId, 'same-operation');
  assert.equal(received[0].read, false);
  service.enable();
  assert.equal(received.length, 1);
});

test('backend accepts notification options and internal destinations', () => {
  const { service, received } = createService();
  service.enable();
  service.notify({
    title: 'Aggiornamento',
    message: 'Versione disponibile',
    level: 'info',
    route: '/updates',
    actionLabel: 'Vai agli aggiornamenti',
    dedupId: 'update-available',
  });
  assert.equal(received[0].route, '/updates');
  assert.equal(received[0].actionLabel, 'Vai agli aggiornamenti');
});

test('controller errors keep the stack in details and a readable user message', () => {
  const { service, received } = createService();
  service.enable();
  new ErrorNotificationService(service).reportControllerError(
    'products:save',
    new Error('Database unavailable'),
  );
  assert.equal(received[0].title, 'Operazione non completata');
  assert.equal(received[0].dedupId, 'controller-error:products:save');
  assert.ok(!received[0].message.includes('Database unavailable'));
  assert.ok(received[0].details.includes('Database unavailable'));
  assert.ok(received[0].details.includes('products:save'));
});
