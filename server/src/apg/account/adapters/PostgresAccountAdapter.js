import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PostgresIdentityAdapter } from '../../infrastructure/adapters/PostgresIdentityAdapter.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export class PostgresAccountAdapter extends PostgresIdentityAdapter {
  constructor(config = {}) {
    super(config);
    this.name = 'postgres-account';
    this.accountSchemaReady = false;
  }

  async ensureSchema() {
    await super.ensureSchema();
    if (this.accountSchemaReady || !this.available) return { ok: this.available, skipped: !this.available };
    const schemaPath = path.resolve(__dirname, '../schema/account-core.sql');
    await this.client.query(fs.readFileSync(schemaPath, 'utf8'));
    this.accountSchemaReady = true;
    return { ok: true };
  }

  async dispose() {
    await super.dispose();
    this.accountSchemaReady = false;
  }
}
