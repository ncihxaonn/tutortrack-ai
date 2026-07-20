import { Payment, ClassType } from '../types';

export interface DerivedPackages {
  /** Size of every package this student has bought for a type, oldest first,
   *  already reduced by any refunds charged back against them. Packages
   *  refunded down to zero are omitted entirely. */
  sizes: number[];
  /** Date of the newest SURVIVING purchase — what the UI labels "last renewed". */
  latestPurchaseDate: string;
  /** Total classes bought minus total refunded, across every package. This is
   *  the honest "how many did they pay for" figure; subtract attendance from it
   *  to get how many are still refundable. */
  netPurchased: number;
  /** Sessions refunded beyond what any package could absorb. Money left the
   *  business for these but no package could give them back. */
  unappliedRefund: number;
}

/**
 * Packages are derived from payments, which are the source of truth for how many
 * classes a student bought. A purchase (positive `classCount`) opens a package; a
 * refund (negative `classCount`) is charged back against packages newest-first.
 *
 * Refunds start at the newest package rather than the oldest because a student
 * asking for money back is returning classes they have not used yet, and unused
 * classes always live in the current package.
 *
 * A refund CASCADES backwards when the newest package cannot absorb it all.
 * Stopping at the newest package would make a zeroed package a black hole:
 * every later refund would be silently swallowed while the money leg still
 * fired, so the same sessions could be refunded over and over. Anything that
 * still cannot be applied after exhausting every package is reported in
 * `unappliedRefund` rather than discarded quietly.
 */
export function derivePackages(payments: Payment[], studentId: string): Map<ClassType, DerivedPackages> {
  const relevant = payments
    .filter(p =>
      p.studentId === studentId &&
      p.classType &&
      typeof p.classCount === 'number' &&
      p.classCount !== 0
    )
    .sort((a, b) => {
      const byDate = new Date(a.date).getTime() - new Date(b.date).getTime();
      if (byDate !== 0) return byDate;
      // Identical timestamps are common — both date editors collapse a changed
      // day to exact local midnight. Sort is stable and rows arrive from the DB
      // newest-first, so without this tiebreak a refund could be applied before
      // the purchase it belongs to and stranded as unapplied. A package must be
      // opened before anything can be charged back against it.
      return (b.classCount as number) - (a.classCount as number);
    });

  type Acc = { pkgs: { size: number; date: string }[]; unapplied: number; firstDate: string };
  const byType = new Map<ClassType, Acc>();

  for (const p of relevant) {
    const type = p.classType as ClassType;
    const count = p.classCount as number;
    let acc = byType.get(type);
    if (!acc) {
      acc = { pkgs: [], unapplied: 0, firstDate: p.date };
      byType.set(type, acc);
    }

    if (count > 0) {
      // An earlier refund that had no package left to come off is settled by the
      // next purchase before that purchase opens. Without this, an over-refund
      // stays stranded forever and `sizes` drifts permanently out of agreement
      // with the money — the card would show a full new package while the refund
      // gate still thought nothing was refundable.
      let size = count;
      if (acc.unapplied > 0) {
        const settled = Math.min(acc.unapplied, size);
        size -= settled;
        acc.unapplied -= settled;
      }
      acc.pkgs.push({ size, date: p.date });
      continue;
    }

    // Charge the refund back, newest package first, cascading into older ones.
    let owed = -count;
    for (let i = acc.pkgs.length - 1; i >= 0 && owed > 0; i--) {
      const take = Math.min(acc.pkgs[i].size, owed);
      acc.pkgs[i].size -= take;
      owed -= take;
    }
    // No package left to charge against (including a refund with no prior
    // purchase at all) — the money still moved, so surface it.
    acc.unapplied += owed;
  }

  const out = new Map<ClassType, DerivedPackages>();
  byType.forEach((acc, type) => {
    const surviving = acc.pkgs.filter(p => p.size > 0);
    const sizes = surviving.map(p => p.size);
    out.set(type, {
      sizes,
      // Label the surviving package with ITS own date, not the date of a newer
      // purchase that has since been refunded away.
      latestPurchaseDate: surviving.length > 0
        ? surviving[surviving.length - 1].date
        : (acc.pkgs.length > 0 ? acc.pkgs[acc.pkgs.length - 1].date : acc.firstDate),
      // Derived FROM sizes rather than re-summed from the raw amounts, so the
      // package card and the refund gate can never disagree about how many
      // classes the student is holding.
      netPurchased: sizes.reduce((sum, n) => sum + n, 0),
      unappliedRefund: acc.unapplied
    });
  });
  return out;
}

/**
 * How many sessions of a type the student has still paid for and not used —
 * the figure a refund must not exceed.
 *
 * Computed globally (net purchased minus all attendance) rather than from the
 * current package's slice, because refunds move the package boundaries around:
 * a per-package figure disagrees with total attendance as soon as a package is
 * shrunk below the number of sessions already taken from it.
 */
export function refundableSessions(netPurchased: number, attendedCount: number): number {
  return Math.max(0, netPurchased - attendedCount);
}
