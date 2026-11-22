import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';

const read = file => readFileSync(new URL('../' + file, import.meta.url), 'utf8');
const beta = read('public/wine-journal/beta.html');
const legacy = read('public/wine-journal/classic.html');
const live = read('public/wine-journal/index.html');
const foundation = read('supabase/wine-journal-v2-foundation.sql');
const invite = read('supabase/wine-journal-v2-invitations.sql');

test('V2 beta module parses as modern JavaScript', () => {
  for(const [label,source] of [['beta',beta],['live',live]]){
  const match = source.match(/<script type="module">([\s\S]*?)<\/script>/);
  assert.ok(match, 'expected a V2 module script');
  const dir = mkdtempSync(join(tmpdir(), 'wine-journal-v2-'));
  try {
    const file = join(dir, 'beta.mjs');
    writeFileSync(file, match[1]);
    execFileSync(process.execPath, ['--check', file], { stdio: 'pipe' });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
  }
});

test('V2 does not reuse any service-role credentials', () => {
  assert.doesNotMatch(beta, /sb_secret_|service_role/i);
  assert.match(beta, /sb_publishable_/);
  assert.match(legacy, /Sign in to your wine journal/);
  assert.match(live, /wj_create_invitation/);
  assert.match(live, /Classic journal/);
  assert.doesNotMatch(live, /sb_secret_|service_role/i);
});

test('New journals default private and old wines have a safe migration path', () => {
  assert.match(foundation, /visibility text not null default 'private'/);
  assert.match(foundation, /'legacy-wine-journal','Our Wine Journal',v_owner,'public'/);
  assert.match(foundation, /v_owner uuid := null/);
  assert.match(foundation, /alter table public\.wines alter column journal_id set default/);
  assert.match(foundation, /create trigger wj_immutable_wine_identity/);
  assert.match(foundation, /drop policy if exists "Public read wines"/);
  assert.match(foundation, /create policy "Journal wine read"/);
});

test('No direct membership or invitation table mutation by client roles', () => {
  assert.match(foundation, /revoke all on public\.profiles,public\.journals,public\.journal_members,/);
  assert.doesNotMatch(foundation, /grant insert on public\.journal_members to authenticated/i);
  assert.doesNotMatch(foundation, /grant insert on public\.journal_invitations to authenticated/i);
  assert.match(foundation, /wine-private-photos/);
  assert.match(foundation, /create policy "Journal photo read"/);
});

test('Invites are hashed, locked, short-lived and non-reusable', () => {
  assert.match(invite, /gen_random_bytes\(16\)/);
  assert.match(invite, /digest\(v_code,'sha256'\)/);
  assert.match(invite, /for update/);
  assert.match(invite, /redeemed_at is not null/);
  assert.match(invite, /Invitation expired/);
  assert.match(invite, /Invitation revoked/);
  assert.match(foundation, /interval '7 days'/);
});

test('Beta uses journal-scoped read/write operations', () => {
  assert.match(beta, /\.eq\('journal_id',activeId\)/);
  assert.match(beta, /wj_create_journal/);
  assert.match(beta, /wj_redeem_invitation/);
  assert.match(beta, /wj_create_invitation/);
  assert.match(beta, /'wine-private-photos'/);
  assert.match(beta, /1–100/);
});
