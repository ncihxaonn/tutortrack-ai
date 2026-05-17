import { Session, AttendanceStatus } from '../types';

export function isTrialForStudent(session: Pick<Session, 'isTrial' | 'studentStatuses'>, studentId: string): boolean {
  const override = session.studentStatuses?.find(s => s.studentId === studentId)?.isTrial;
  if (typeof override === 'boolean') return override;
  return !!session.isTrial;
}

export function statusForStudent(session: Pick<Session, 'status' | 'studentStatuses'>, studentId: string): AttendanceStatus {
  return session.studentStatuses?.find(s => s.studentId === studentId)?.status || session.status;
}

// Chargeable === counts toward both balance AND package depletion. We treat
// Present and Late identically here so a student can't pay-but-not-deplete a
// package by being marked late. Absent and Cancelled never charge.
export function isChargeableStatus(status: AttendanceStatus): boolean {
  return status === AttendanceStatus.Present || status === AttendanceStatus.Late;
}

// Convenience: combine the per-student lookup with the chargeable predicate.
export function isChargeableForStudent(
  session: Pick<Session, 'status' | 'studentStatuses' | 'isTrial'>,
  studentId: string
): boolean {
  if (isTrialForStudent(session, studentId)) return false;
  return isChargeableStatus(statusForStudent(session, studentId));
}

// Per-student price share, accounting for per-student trial overrides. If a
// student is on trial they pay 0; otherwise the session price is split evenly
// across non-trial attendees. When NO override is set on any student, this
// degenerates to `price / studentIds.length`, matching the legacy behavior.
export function pricePerStudent(session: Session, studentId: string): number {
  if (isTrialForStudent(session, studentId)) return 0;
  if (session.studentIds.length === 0) return 0;
  const nonTrialCount = session.studentIds.filter(sid => !isTrialForStudent(session, sid)).length;
  if (nonTrialCount === 0) return 0;
  return session.price / nonTrialCount;
}
