import { IdentityProvider } from '../IdentityProvider.js';

export class NativeApgProvider extends IdentityProvider {
  constructor() {
    super('native-apg');
  }
}
