import fs from 'node:fs';

function normalizeDigest(value) {
  const digest = String(value || '').trim();
  if (!digest) return '';
  return digest.startsWith('sha256:') ? digest : `sha256:${digest}`;
}

export function productionDigestFromRevisions(revisions) {
  if (!Array.isArray(revisions) || revisions.length === 0) return '';
  const revision = revisions.find(item => String(item.status || '').toUpperCase() === 'ACTIVE')
    || revisions[0];
  const image = revision.image || {};
  const environment = image.environment || revision.environment || {};
  const imageUrl = typeof image === 'string' ? image : image.image_url || '';
  const fromUrl = imageUrl.includes('@sha256:') ? imageUrl.split('@').pop() : '';
  return normalizeDigest(image.image_digest || fromUrl || environment.IMAGE_DIGEST);
}

export function compareImageDigests(candidate, production) {
  const candidateDigest = normalizeDigest(candidate);
  const productionDigest = normalizeDigest(production);
  if (!candidateDigest) throw new Error('Candidate OCI image digest is missing.');
  if (!productionDigest) throw new Error('Production image digest could not be resolved safely.');
  return {
    candidateDigest,
    productionDigest,
    identical: candidateDigest === productionDigest,
    status: candidateDigest === productionDigest ? 'SKIPPED_IDENTICAL_IMAGE' : 'NEW_IMAGE',
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [candidate, revisionsArg] = process.argv.slice(2);
  const revisionsJson = revisionsArg || fs.readFileSync(0, 'utf8');
  const comparison = compareImageDigests(candidate, productionDigestFromRevisions(JSON.parse(revisionsJson)));
  process.stdout.write(JSON.stringify(comparison));
}
