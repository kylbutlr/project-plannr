import {existsSync} from 'node:fs';
import {resolve} from 'node:path';
import {loadEnvFile} from 'node:process';
import {scryptSync, randomBytes} from 'node:crypto';

export function loadLocalEnv() {
  if (existsSync('.env')) loadEnvFile('.env');
}

export function configuration(env = process.env) {
  const port = Number(env.PROJECT_PLANNR_PORT || 4205);
  if (!Number.isInteger(port) || port < 1024 || port > 65535) throw Error('PROJECT_PLANNR_PORT must be between 1024 and 65535.');
  const mode = env.PLANNR_MODE || 'private';
  if (!['private', 'demo'].includes(mode)) throw Error('PLANNR_MODE must be private or demo.');
  const origin = env.PLANNR_ORIGIN || `http://127.0.0.1:${port}`;
  const parsed = new URL(origin);
  if (parsed.origin !== origin || parsed.username || parsed.password || !['http:', 'https:'].includes(parsed.protocol)) throw Error('PLANNR_ORIGIN must be an exact HTTP(S) origin.');
  const loopback = ['127.0.0.1', 'localhost'].includes(parsed.hostname);
  if (parsed.protocol !== 'https:' && !loopback) throw Error('Non-local origins require HTTPS.');
  if (mode === 'demo' && (!loopback || env.DATABASE_URL)) throw Error('Demo mode is loopback-only and cannot use a database.');
  const databaseUrl = env.DATABASE_URL || null;
  if (databaseUrl && env.PLANNR_DATABASE_BRANCH !== 'development') throw Error('This development milestone requires PLANNR_DATABASE_BRANCH=development. Production access is not enabled.');
  if (databaseUrl) {
    const database = new URL(databaseUrl);
    if (!['postgres:', 'postgresql:'].includes(database.protocol) || !env.PLANNR_DATABASE_HOST || database.hostname !== env.PLANNR_DATABASE_HOST) throw Error('DATABASE_URL must match the explicitly configured development database host.');
  }
  const authMode = env.PLANNR_AUTH_MODE || 'password';
  if (!['password', 'none'].includes(authMode)) throw Error('PLANNR_AUTH_MODE must be password or none.');
  const passwordless = authMode === 'none';
  if (passwordless && (!loopback || env.NETLIFY === 'true')) throw Error('Passwordless access is available only for a standalone loopback server.');
  const password = env.PLANNR_PASSWORD || '';
  if (passwordless && password) throw Error('Remove PLANNR_PASSWORD or select PLANNR_AUTH_MODE=password.');
  if (password && (password.length < 16 || password.length > 256)) throw Error('PLANNR_PASSWORD must contain between 16 and 256 characters. Use a unique password-manager-generated password.');
  if (!loopback && (!databaseUrl || !password)) throw Error('Hosted mode requires database storage and fully configured owner authentication.');
  return {port, mode, origin, authMode, passwordless, localCsrf: passwordless ? randomBytes(32).toString('base64url') : null, secure: parsed.protocol === 'https:', databaseUrl,
    dataFile: resolve(env.PLANNR_DATA_FILE || 'data/workspace.json'), ownerId: 'owner',
    passwordDigest: password ? scryptSync(password, 'project-plannr:workspace-password:v1', 32).toString('hex') : '',
    authConfigured: Boolean(password)};
}
