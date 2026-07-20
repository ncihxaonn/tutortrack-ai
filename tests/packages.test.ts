import { describe, it, expect } from 'vitest';
import { derivePackages, refundableSessions } from '../lib/packages';
import { Payment, ClassType } from '../types';

const pay = (over: Partial<Payment>): Payment => ({
  id: 'p1',
  studentId: 'stu1',
  amount: 400,
  date: '2026-01-01T00:00:00.000Z',
  method: 'WeChat',
  classCount: 10,
  classType: ClassType.OneOnOne,
  ...over
});

const sizes = (ps: Payment[], id = 'stu1', type = ClassType.OneOnOne) =>
  derivePackages(ps, id).get(type)?.sizes;

describe('derivePackages', () => {
  it('treats each positive payment as its own package, oldest first', () => {
    const out = sizes([
      pay({ id: 'a', date: '2026-01-01T00:00:00.000Z', classCount: 10 }),
      pay({ id: 'b', date: '2026-03-01T00:00:00.000Z', classCount: 20 })
    ]);
    expect(out).toEqual([10, 20]);
  });

  it('subtracts a refund from the current package', () => {
    const out = sizes([
      pay({ id: 'a', date: '2026-01-01T00:00:00.000Z', classCount: 10 }),
      pay({ id: 'r', date: '2026-02-01T00:00:00.000Z', classCount: -4, amount: -160 })
    ]);
    expect(out).toEqual([6]);
  });

  it('charges a refund against the NEWEST package, not the oldest', () => {
    const out = sizes([
      pay({ id: 'a', date: '2026-01-01T00:00:00.000Z', classCount: 10 }),
      pay({ id: 'b', date: '2026-03-01T00:00:00.000Z', classCount: 10 }),
      pay({ id: 'r', date: '2026-04-01T00:00:00.000Z', classCount: -3, amount: -120 })
    ]);
    expect(out).toEqual([10, 7]);
  });

  it('drops a package refunded down to zero rather than keeping a phantom slot', () => {
    // Over-refunding must not leave a negative package that would silently
    // hand back sessions the next time the student buys, and a 0-size package
    // must not survive: it can never satisfy `remaining <= size` in lesson
    // numbering, so it would inflate every later package index.
    const out = sizes([
      pay({ id: 'a', classCount: 10 }),
      pay({ id: 'r', date: '2026-02-01T00:00:00.000Z', classCount: -50, amount: -2000 })
    ]);
    expect(out).toEqual([]);
  });

  it('cascades a refund back into older packages instead of stopping at the newest', () => {
    // Without cascading, the -12 would take 10 off the newest package and drop
    // the remaining 2 on the floor.
    const out = sizes([
      pay({ id: 'a', date: '2026-01-01T00:00:00.000Z', classCount: 10 }),
      pay({ id: 'b', date: '2026-02-01T00:00:00.000Z', classCount: 10 }),
      pay({ id: 'r', date: '2026-03-01T00:00:00.000Z', classCount: -12, amount: -480 })
    ]);
    expect(out).toEqual([8]);
  });

  it('does not let a zeroed package become a black hole that swallows later refunds', () => {
    // Regression: when refunds stopped at the newest package, a package already
    // at 0 absorbed every subsequent refund via Math.max(0, 0 - n). The money
    // leg still fired each time, so the same sessions could be refunded forever.
    const base = [
      pay({ id: 'a', date: '2026-01-01T00:00:00.000Z', classCount: 10 }),
      pay({ id: 'b', date: '2026-02-01T00:00:00.000Z', classCount: 10 }),
      pay({ id: 'r1', date: '2026-03-01T00:00:00.000Z', classCount: -10, amount: -400 })
    ];
    expect(sizes(base)).toEqual([10]);
    // A second refund must keep eating into the surviving package, not vanish.
    expect(sizes([...base, pay({ id: 'r2', date: '2026-04-01T00:00:00.000Z', classCount: -7 })]))
      .toEqual([3]);
  });

  it('settles a stranded over-refund against the next purchase', () => {
    // Over-refund 14 against a 10-package, then buy 10 more. The stranded 4 must
    // come off the new package, not be forgotten — otherwise sizes would say 10
    // while the money said 6, and the two would never reconcile.
    const out = derivePackages([
      pay({ id: 'a', date: '2026-01-01T00:00:00.000Z', classCount: 10 }),
      pay({ id: 'r', date: '2026-02-01T00:00:00.000Z', classCount: -14, amount: -560 }),
      pay({ id: 'b', date: '2026-03-01T00:00:00.000Z', classCount: 10 })
    ], 'stu1').get(ClassType.OneOnOne);
    expect(out?.sizes).toEqual([6]);
    expect(out?.netPurchased).toBe(6);
    expect(out?.unappliedRefund).toBe(0);
  });

  it('keeps netPurchased equal to the sum of sizes in every sequence', () => {
    const sequences: number[][] = [
      [10, -4],
      [5, -25, 20],
      [10, -14, 10],
      [10, 10, -12],
      [10, -10, -5, 10],
      [-4, 10],
      [3, 3, 3, -9, 5]
    ];
    for (const seq of sequences) {
      const ps = seq.map((n, i) => pay({
        id: `p${i}`,
        date: `2026-01-${String(i + 1).padStart(2, '0')}T00:00:00.000Z`,
        classCount: n
      }));
      const d = derivePackages(ps, 'stu1').get(ClassType.OneOnOne);
      const sum = (d?.sizes ?? []).reduce((s, n) => s + n, 0);
      expect(sum, `sequence ${JSON.stringify(seq)}`).toBe(d?.netPurchased ?? 0);
      expect(d?.sizes.every(n => n > 0), `sequence ${JSON.stringify(seq)}`).toBe(true);
    }
  });

  it('applies a purchase before a refund that carries the identical timestamp', () => {
    // Payments arrive from the DB newest-first and both date editors collapse a
    // changed day to exact local midnight, so ties are routine. Without an
    // explicit tiebreak the refund would be seen first and stranded.
    const sameDay = '2026-03-01T00:00:00.000Z';
    const refundFirst = derivePackages([
      pay({ id: 'r', date: sameDay, classCount: -10, amount: -400 }),
      pay({ id: 'a', date: sameDay, classCount: 10 })
    ], 'stu1').get(ClassType.OneOnOne);
    const purchaseFirst = derivePackages([
      pay({ id: 'a', date: sameDay, classCount: 10 }),
      pay({ id: 'r', date: sameDay, classCount: -10, amount: -400 })
    ], 'stu1').get(ClassType.OneOnOne);
    expect(refundFirst?.sizes).toEqual([]);
    expect(refundFirst?.unappliedRefund).toBe(0);
    // Row order must not change the answer.
    expect(refundFirst?.sizes).toEqual(purchaseFirst?.sizes);
    expect(refundFirst?.netPurchased).toBe(purchaseFirst?.netPurchased);
  });

  it('reports sessions refunded beyond anything a package can cover', () => {
    const out = derivePackages([
      pay({ id: 'a', classCount: 10 }),
      pay({ id: 'r', date: '2026-02-01T00:00:00.000Z', classCount: -14, amount: -560 })
    ], 'stu1').get(ClassType.OneOnOne);
    expect(out?.sizes).toEqual([]);
    expect(out?.unappliedRefund).toBe(4);
    expect(out?.netPurchased).toBe(0);
  });

  it('tracks net purchased across packages so refundable count never leaks', () => {
    const out = derivePackages([
      pay({ id: 'a', date: '2026-01-01T00:00:00.000Z', classCount: 10 }),
      pay({ id: 'r', date: '2026-02-01T00:00:00.000Z', classCount: -4, amount: -160 }),
      pay({ id: 'b', date: '2026-03-01T00:00:00.000Z', classCount: 10 })
    ], 'stu1').get(ClassType.OneOnOne);
    expect(out?.netPurchased).toBe(16);
    // 10 attended out of 16 paid-for leaves 6 genuinely refundable.
    expect(refundableSessions(out!.netPurchased, 10)).toBe(6);
    expect(refundableSessions(out!.netPurchased, 20)).toBe(0);
  });

  it('labels the surviving package with its own purchase date', () => {
    // The Feb package was refunded away entirely; "last renewed" must point at
    // the January package that actually survives, not the vanished Feb one.
    const out = derivePackages([
      pay({ id: 'a', date: '2026-01-01T00:00:00.000Z', classCount: 10 }),
      pay({ id: 'b', date: '2026-02-01T00:00:00.000Z', classCount: 5 }),
      pay({ id: 'r', date: '2026-03-01T00:00:00.000Z', classCount: -5, amount: -200 })
    ], 'stu1').get(ClassType.OneOnOne);
    expect(out?.sizes).toEqual([10]);
    expect(out?.latestPurchaseDate).toBe('2026-01-01T00:00:00.000Z');
  });

  it('does not renumber later packages when an earlier one was fully refunded', () => {
    // Buy 10, use them, buy 10 more, refund all of the second package.
    // The survivor is the first package alone — not [10, 0], which would make
    // the next lesson report "package 3" for a package that was never bought.
    const out = sizes([
      pay({ id: 'a', date: '2026-01-01T00:00:00.000Z', classCount: 10 }),
      pay({ id: 'b', date: '2026-03-01T00:00:00.000Z', classCount: 10 }),
      pay({ id: 'r', date: '2026-04-01T00:00:00.000Z', classCount: -10, amount: -400 })
    ]);
    expect(out).toEqual([10]);
  });

  it('keeps real-time ordering so a same-day refund hits the package it belongs to', () => {
    // Refund at 09:00 against the old package, new purchase at 14:00 the same
    // day. If the purchase were stamped at local midnight it would sort first
    // and swallow the refund, showing 6 remaining instead of a fresh 10.
    const out = sizes([
      pay({ id: 'a', date: '2026-01-01T00:00:00.000Z', classCount: 10 }),
      pay({ id: 'r', date: '2026-02-10T09:00:00.000Z', classCount: -4, amount: -160 }),
      pay({ id: 'b', date: '2026-02-10T14:00:00.000Z', classCount: 10 })
    ]);
    expect(out).toEqual([6, 10]);
  });

  it('does not let a refund leak across class types', () => {
    const ps = [
      pay({ id: 'a', classCount: 10, classType: ClassType.OneOnOne }),
      pay({ id: 'b', classCount: 10, classType: ClassType.Group }),
      pay({ id: 'r', date: '2026-02-01T00:00:00.000Z', classCount: -4, classType: ClassType.Group })
    ];
    expect(sizes(ps, 'stu1', ClassType.OneOnOne)).toEqual([10]);
    expect(sizes(ps, 'stu1', ClassType.Group)).toEqual([6]);
  });

  it('does not let a refund leak across students', () => {
    const ps = [
      pay({ id: 'a', studentId: 'stu1', classCount: 10 }),
      pay({ id: 'r', studentId: 'stu2', date: '2026-02-01T00:00:00.000Z', classCount: -4 })
    ];
    expect(sizes(ps, 'stu1')).toEqual([10]);
  });

  it('ignores a refund that has no package to charge back against', () => {
    const out = derivePackages(
      [pay({ id: 'r', classCount: -4, amount: -160 })],
      'stu1'
    ).get(ClassType.OneOnOne);
    expect(out?.sizes).toEqual([]);
  });

  it('applies refunds in date order, not array order', () => {
    // Payments arrive from the DB unsorted; a refund must land on whichever
    // package was current on the refund's own date.
    const out = sizes([
      pay({ id: 'r', date: '2026-02-01T00:00:00.000Z', classCount: -4 }),
      pay({ id: 'b', date: '2026-03-01T00:00:00.000Z', classCount: 20 }),
      pay({ id: 'a', date: '2026-01-01T00:00:00.000Z', classCount: 10 })
    ]);
    expect(out).toEqual([6, 20]);
  });

  it('reports a purchase date, never a refund date, as the renewal date', () => {
    const out = derivePackages([
      pay({ id: 'a', date: '2026-01-01T00:00:00.000Z', classCount: 10 }),
      pay({ id: 'r', date: '2026-02-01T00:00:00.000Z', classCount: -4 })
    ], 'stu1').get(ClassType.OneOnOne);
    expect(out?.latestPurchaseDate).toBe('2026-01-01T00:00:00.000Z');
  });

  it('skips payments with no classCount or no classType', () => {
    const out = sizes([
      pay({ id: 'a', classCount: 10 }),
      pay({ id: 'x', date: '2026-02-01T00:00:00.000Z', classCount: undefined }),
      pay({ id: 'y', date: '2026-02-02T00:00:00.000Z', classType: undefined })
    ]);
    expect(out).toEqual([10]);
  });
});
