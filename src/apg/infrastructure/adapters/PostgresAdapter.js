import { BaseDataAdapter } from './BaseDataAdapter.js';

export class PostgresAdapter extends BaseDataAdapter {
  constructor() {
    super('postgres');
  }
}
