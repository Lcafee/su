import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const root = process.cwd();
const boundaryPath = path.join(root, '.agent', 'project-boundary.json');
const boundary = JSON.parse(fs.readFileSync(boundaryPath, 'utf8'));

function fail(message) {
  console.error(`SCOPE_VIOLATION: ${message}`);
  process.exit(1);
}

let remote = '';
try {
  remote = execFileSync('git', ['config', '--get', 'remote.origin.url'], { cwd: root, encoding: 'utf8' }).trim();
} catch {
  fail('cannot resolve git remote.origin.url');
}

const expectedRepo = boundary.repository;
const acceptedRemote = remote === `https://github.com/${expectedRepo}.git`
  || remote === `git@github.com:${expectedRepo}.git`
  || remote === `https://github.com/${expectedRepo}`;

if (!acceptedRemote) fail(`repository mismatch; expected ${expectedRepo}, got ${remote || '<empty>'}`);
if (boundary.project_id !== 'lcafe-main-site') fail(`project_id mismatch: ${boundary.project_id}`);
if (boundary.runtime?.service !== 'lcafe-site-api') fail(`service mismatch: ${boundary.runtime?.service}`);
if (boundary.runtime?.code_root !== '/srv/lcafe-site') fail(`code root mismatch: ${boundary.runtime?.code_root}`);
if (boundary.runtime?.data_root !== '/var/lib/lcafe-site') fail(`data root mismatch: ${boundary.runtime?.data_root}`);
if (boundary.runtime?.api_bind !== '127.0.0.1:3100') fail(`API bind mismatch: ${boundary.runtime?.api_bind}`);

console.log('AGENT_SCOPE_OK lcafe-main-site');
