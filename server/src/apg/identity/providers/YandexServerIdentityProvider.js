import { ServerIdentityProvider } from '../ServerIdentityProvider.js';

export class YandexServerIdentityProvider extends ServerIdentityProvider {
  constructor() {
    super('yandex-server');
  }
}
