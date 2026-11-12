import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { generateSmartUsernames, sanitizeNameTokens } from './usernameGenerator';

describe('Smart Username Generator', () => {
  it('sanitizes name tokens correctly, stripping titles and punctuation', () => {
    const tokens = sanitizeNameTokens('Dr. H. Ahmad Dahlan, S.Kom.');
    // 'dr', 'h' are titles/short (<3 chars), degrees after comma are stripped
    assert.deepEqual(tokens, ['ahmad', 'dahlan']);
  });

  it('assigns first word when first names are unique', () => {
    const employees = [
      { id: 1, fullName: 'Budi Santoso' },
      { id: 2, fullName: 'Siti Aminah' },
    ];
    const result = generateSmartUsernames(employees, new Set());
    assert.equal(result.get(1), 'budi');
    assert.equal(result.get(2), 'siti');
  });

  it('uses second word when first names collide (e.g. Muhammad Ali & Muhammad Bagus -> ali & bagus)', () => {
    const employees = [
      { id: 10, fullName: 'Muhammad Ali' },
      { id: 11, fullName: 'Muhammad Bagus' },
    ];
    const result = generateSmartUsernames(employees, new Set());
    assert.equal(result.get(10), 'ali');
    assert.equal(result.get(11), 'bagus');
  });

  it('uses third word when first and second words both collide', () => {
    const employees = [
      { id: 20, fullName: 'Muhammad Ali Ridho' },
      { id: 21, fullName: 'Muhammad Ali Fajar' },
    ];
    const result = generateSmartUsernames(employees, new Set());
    assert.equal(result.get(20), 'ridho');
    assert.equal(result.get(21), 'fajar');
  });

  it('handles conflict with existing database usernames', () => {
    const existingInDb = new Set(['budi']);
    const employees = [
      { id: 30, fullName: 'Budi Santoso' },
    ];
    const result = generateSmartUsernames(employees, existingInDb);
    // Since 'budi' already exists, it advances to second word 'santoso'
    assert.equal(result.get(30), 'santoso');
  });

  it('appends numeric suffix for single-name collisions or exhausted names', () => {
    const employees = [
      { id: 40, fullName: 'Dewi' },
      { id: 41, fullName: 'Dewi' },
    ];
    const result = generateSmartUsernames(employees, new Set());
    assert.equal(result.get(40), 'dewi');
    assert.equal(result.get(41), 'dewi1');
  });

  it('ensures all generated usernames meet minimum length (>= 3 chars)', () => {
    const employees = [
      { id: 50, fullName: 'M. Rizki' },
    ];
    const result = generateSmartUsernames(employees, new Set());
    assert.equal(result.get(50), 'rizki');
  });
});
