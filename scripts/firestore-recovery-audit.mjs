import fs from 'node:fs';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { GoogleAuth } from 'google-auth-library';

const SERVICE_ACCOUNT_PATH = process.env.GOOGLE_APPLICATION_CREDENTIALS || 'server/firebase-service-account.json';
const serviceAccount = JSON.parse(fs.readFileSync(SERVICE_ACCOUNT_PATH, 'utf8'));

if (!getApps().length) initializeApp({ credential: cert(serviceAccount) });

function cleanError(error) {
  return {
    code: error?.code ?? error?.response?.status ?? '',
    status: error?.status ?? error?.response?.data?.error?.status ?? '',
    message: String(error?.message || error).slice(0, 500),
    details: error?.details || error?.response?.data?.error?.details || null,
    reason: error?.response?.data?.error?.errors?.[0]?.reason || '',
    domain: error?.response?.data?.error?.errors?.[0]?.domain || '',
    metadata: error?.metadata?.getMap ? error.metadata.getMap() : undefined,
  };
}

async function measure(name, fn) {
  const startedAt = Date.now();
  try {
    const value = await fn();
    return { name, ok: true, durationMs: Date.now() - startedAt, ...value };
  } catch (error) {
    return { name, ok: false, durationMs: Date.now() - startedAt, error: cleanError(error) };
  }
}

async function googleClient() {
  const auth = new GoogleAuth({
    credentials: serviceAccount,
    scopes: [
      'https://www.googleapis.com/auth/cloud-platform',
      'https://www.googleapis.com/auth/datastore',
    ],
  });
  return auth.getClient();
}

async function run() {
  const db = getFirestore();
  const auth = getAuth();
  const client = await googleClient();
  const projectId = serviceAccount.project_id;
  const projectNumber = projectId === 'project-apg-bbfc8' ? '946188358768' : '';
  const checks = [];

  checks.push({
    name: 'firebase_project',
    ok: true,
    projectId,
    clientEmail: serviceAccount.client_email,
  });

  checks.push(await measure('firebase_auth_list_users_1', async () => {
    const result = await auth.listUsers(1);
    return { users: result.users.length };
  }));

  for (const collectionName of ['users', 'emailIndex', 'auth_map', 'tgLinks', 'canonicalUsers', 'identityLinks', 'config']) {
    checks.push(await measure(`firestore_admin_${collectionName}_limit_1`, async () => {
      const snap = await db.collection(collectionName).limit(1).get();
      return { documents: snap.size };
    }));
  }

  checks.push(await measure('firestore_database_metadata', async () => {
    const res = await client.request({
      url: `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)`,
      method: 'GET',
      timeout: 20000,
    });
    const data = res.data || {};
    return {
      database: {
        name: data.name,
        type: data.type,
        locationId: data.locationId,
        concurrencyMode: data.concurrencyMode,
        appEngineIntegrationMode: data.appEngineIntegrationMode,
        pointInTimeRecoveryEnablement: data.pointInTimeRecoveryEnablement,
      },
    };
  }));

  checks.push(await measure('firestore_rest_users_page_1', async () => {
    const res = await client.request({
      url: `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/users?pageSize=1`,
      method: 'GET',
      timeout: 20000,
    });
    return { documents: res.data?.documents?.length || 0 };
  }));

  for (const service of ['firestore.googleapis.com', 'identitytoolkit.googleapis.com']) {
    checks.push(await measure(`service_usage_${service}`, async () => {
      const res = await client.request({
        url: `https://serviceusage.googleapis.com/v1/projects/${projectId}/services/${service}`,
        method: 'GET',
        timeout: 20000,
      });
      return { serviceState: res.data?.state || '', serviceTitle: res.data?.config?.title || '' };
    }));
  }

  if (projectNumber) {
    checks.push(await measure('service_usage_firestore_quota_metrics', async () => {
      const res = await client.request({
        url: `https://serviceusage.googleapis.com/v1beta1/projects/${projectNumber}/services/firestore.googleapis.com/consumerQuotaMetrics`,
        method: 'GET',
        timeout: 20000,
      });
      return { metricCount: res.data?.metrics?.length || 0 };
    }));
  }

  checks.push(await measure('cloud_billing_project', async () => {
    const res = await client.request({
      url: `https://cloudbilling.googleapis.com/v1/projects/${projectId}/billingInfo`,
      method: 'GET',
      timeout: 20000,
    });
    return { billingEnabled: Boolean(res.data?.billingEnabled), billingAccountPresent: Boolean(res.data?.billingAccountName) };
  }));

  const firestoreDataChecks = checks.filter(item => item.name.startsWith('firestore_admin_') || item.name === 'firestore_rest_users_page_1');
  const firestoreFailures = firestoreDataChecks.filter(item => !item.ok);
  const authOk = checks.find(item => item.name === 'firebase_auth_list_users_1')?.ok === true;
  const metadataOk = checks.find(item => item.name === 'firestore_database_metadata')?.ok === true;
  const allDataReadsQuota = firestoreFailures.length >= 2 && firestoreFailures.every(item => {
    const message = String(item.error?.message || '');
    return message.includes('Quota exceeded') || item.error?.status === 'RESOURCE_EXHAUSTED' || item.error?.code === 8 || item.error?.code === 429;
  });

  const conclusion = {
    rootCause: allDataReadsQuota && authOk && metadataOk
      ? 'FIRESTORE_DATA_PLANE_QUOTA_EXHAUSTED'
      : 'FIRESTORE_RECOVERY_REQUIRES_CONSOLE_VERIFICATION',
    canSnapshotNow: firestoreFailures.length === 0,
    authAvailable: authOk,
    firestoreMetadataAvailable: metadataOk,
    firestoreDataReadsAvailable: firestoreFailures.length === 0,
    recommendedNextStep: firestoreFailures.length === 0
      ? 'Run Identity Migration Center snapshot -> dry-run -> import -> verify.'
      : 'Restore Firestore quota/billing or wait for quota reset, then rerun this audit before snapshot.',
  };

  console.log(JSON.stringify({
    ok: conclusion.canSnapshotNow,
    generatedAt: new Date().toISOString(),
    checks,
    conclusion,
  }, null, 2));

  if (!conclusion.canSnapshotNow) process.exitCode = 1;
}

run().catch(error => {
  console.error(JSON.stringify({ ok: false, error: cleanError(error) }, null, 2));
  process.exit(1);
});
