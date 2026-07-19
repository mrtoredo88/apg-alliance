import { ServerIdentityProvider } from '../ServerIdentityProvider.js';

export class NativeApgServerIdentityProvider extends ServerIdentityProvider {
  constructor() {
    super('native-apg-server');
  }
}
