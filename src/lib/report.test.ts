import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildReportUrl } from './report.ts';

test('제보 링크는 가이드 제목을 폼의 미리 채우기 값으로 붙인다', () => {
  assert.equal(
    buildReportUrl('https://docs.google.com/forms/d/e/X/viewform?usp=pp_url&entry.1=', 'ChatGPT & 엑셀: 시작'),
    'https://docs.google.com/forms/d/e/X/viewform?usp=pp_url&entry.1=ChatGPT%20%26%20%EC%97%91%EC%85%80%3A%20%EC%8B%9C%EC%9E%91',
  );
});

test('폼 주소가 비어 있으면 링크를 만들지 않는다', () => {
  assert.equal(buildReportUrl('', '제목'), '');
});
