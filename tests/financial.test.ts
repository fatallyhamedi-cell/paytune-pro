import { describe, it } from 'node:test';
import assert from 'node:assert';
import { calculateSplit } from '../src/services/paymentService';
import { calculateSplit as calculateSplitFromSplitter } from '../src/services/paymentSplitter';

describe('Financial & Commission Split Engine', () => {
  it('correctly calculates 5% VAT and 70/30 split on standard 1000 RWF purchase', () => {
    const amount = 1000;
    const split = calculateSplit(amount);

    // 5% VAT of 1000 = 50 RWF
    assert.strictEqual(split.vat, 50, 'VAT should be 5% (50 RWF)');
    // After VAT = 950 RWF
    assert.strictEqual(split.afterVat, 950, 'After-VAT amount should be 950 RWF');
    // Artist share = 70% of 950 = 665 RWF
    assert.strictEqual(split.artistShare, 665, 'Artist share should be 70% (665 RWF)');
    // Platform owner share = 30% of 950 = 285 RWF
    assert.strictEqual(split.ownerShare, 285, 'Platform share should be 30% (285 RWF)');

    // Invariance check: artist + owner + vat must equal total
    const totalReconstituted = split.artistShare + split.ownerShare + split.vat;
    assert.strictEqual(totalReconstituted, amount, 'All split shares plus VAT must sum to exact total');
  });

  it('correctly calculates split on 500 RWF minimum standard music video', () => {
    const amount = 500;
    const split = calculateSplit(amount);

    // 5% VAT of 500 = 25 RWF
    assert.strictEqual(split.vat, 25);
    // After VAT = 475 RWF
    assert.strictEqual(split.afterVat, 475);
    // Artist share = 70% of 475 = 332.5 RWF -> rounded to 332.50
    assert.strictEqual(split.artistShare, 332.5);
    // Owner share = 30% of 475 = 142.5 RWF -> rounded to 142.50
    assert.strictEqual(split.ownerShare, 142.5);

    const total = split.artistShare + split.ownerShare + split.vat;
    assert.strictEqual(total, 500);
  });

  it('handles edge case amounts without floating point drift', () => {
    const amounts = [200, 350, 750, 1500, 5000, 10000];
    for (const amt of amounts) {
      const split = calculateSplit(amt);
      assert.ok(split.vat >= 0, 'VAT must be non-negative');
      assert.ok(split.artistShare > split.ownerShare, 'Artist share (70%) must exceed platform share (30%)');
      const sum = Number((split.artistShare + split.ownerShare + split.vat).toFixed(2));
      assert.strictEqual(sum, amt, `Total sum must match original amount for ${amt}`);
    }
  });

  it('preserves split parity between paymentService and paymentSplitter module', () => {
    const testAmounts = [500, 1000, 2500];
    for (const amt of testAmounts) {
      const s1 = calculateSplit(amt);
      const s2 = calculateSplitFromSplitter(amt);
      assert.strictEqual(s1.vat, s2.vat);
      assert.strictEqual(s1.afterVat, s2.afterVat);
      assert.strictEqual(s1.artistShare, s2.artistShare);
      assert.strictEqual(s1.ownerShare, s2.ownerShare);
    }
  });
});
