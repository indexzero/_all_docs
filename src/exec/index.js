import crypto from 'node:crypto';

function execId(length) {
  return crypto.randomBytes(Math.ceil(length / 2))
    .toString('hex')
    .slice(0, length);
}

export { execId };
