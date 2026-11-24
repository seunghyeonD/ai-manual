import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isPublishable } from './publishable.ts';
import { ROLES, roleSlug, roleFromSlug } from '../config/roles.ts';

test('검증일 없는 가이드는 기본적으로 공개되지 않는다', () => {
  assert.equal(isPublishable({}, false), false);
  assert.equal(isPublishable({ verifiedAt: '2026-11-24' }, false), true);
});

test('초안 표시가 켜지면 미검증 가이드도 보인다', () => {
  assert.equal(isPublishable({}, true), true);
});

test('직군 슬러그는 왕복 변환된다', () => {
  for (const r of ROLES) assert.equal(roleFromSlug(roleSlug(r)), r);
  assert.equal(roleFromSlug('nope'), undefined);
});
