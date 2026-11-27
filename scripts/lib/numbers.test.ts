import { test } from 'node:test';
import assert from 'node:assert/strict';
import { unsupportedNumbers } from './numbers.ts';

test('요약의 숫자가 원문에 그대로 있으면 통과한다', () => {
  assert.deepEqual(unsupportedNumbers(['응답자의 47%가 그렇다고 답했습니다.', '요금은 0.10~0.50달러입니다.'], '47% of respondents ... $0.10 to $0.50'), []);
});

test('원문에 없는 숫자를 찾아낸다', () => {
  assert.deepEqual(unsupportedNumbers(['2026년 4월1일부터 적용됩니다.'], '내년 4월1일부터 확장 등급에 요금을 부과한다.'), ['2026']);
});

test('천 단위 쉼표는 같은 숫자로 본다', () => {
  assert.deepEqual(unsupportedNumbers(['요청 1000건당', '1,500명'], 'per 1,000 requests, 1500 people'), []);
});

test('영어 달 이름은 숫자 달로 읽는다', () => {
  assert.deepEqual(unsupportedNumbers(['10월에 나왔습니다.'], 'This launched in October.'), []);
  assert.deepEqual(unsupportedNumbers(['9월에 나왔습니다.'], 'This launched in October.'), ['9']);
});

test('영어로 쓴 작은 숫자를 읽는다', () => {
  assert.deepEqual(unsupportedNumbers(['3가지 기능이 추가됐습니다.'], 'It adds three features.'), []);
});

test('million, billion을 만·억 단위로 읽는다', () => {
  assert.deepEqual(unsupportedNumbers(['500만 명이 씁니다.', '20억 달러를 투자합니다.', '1조 원 규모입니다.'], '5 million users, $2 billion, 1 trillion won'), []);
  assert.deepEqual(unsupportedNumbers(['150만 명이 씁니다.'], '1.5 million users'), []);
});

test('소수점 뒤 0은 같은 숫자로 본다', () => {
  assert.deepEqual(unsupportedNumbers(['0.5달러', '2배'], '$0.50 and 2.0x'), []);
});

test('같은 숫자는 한 번만 알린다', () => {
  assert.deepEqual(unsupportedNumbers(['99명', '99개'], '없음'), ['99']);
});
