import { Session, AttendanceStatus } from '../types';

export function isTrialForStudent(session: Pick<Session, 'isTrial' | 'studentStatuses'>, studentId: string): boolean {
  const override = session.studentStatuses?.find(s => s.studentId === studentId)?.isTrial;
  if (typeof override === 'boolean') return override;
  return !!session.isTrial;
}

export function statusForStudent(session: Pick<Session, 'status' | 'studentStatuses'>, studentId: string): AttendanceStatus {
  return session.studentStatuses?.find(s => s.studentId === studentId)?.status || session.status;
}
