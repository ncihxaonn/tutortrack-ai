import { describe, it, expect } from 'vitest';
import { Session, AttendanceStatus, ClassType } from '../types';
import {
  isTrialForStudent,
  statusForStudent,
  isChargeableStatus,
  isChargeableForStudent,
  pricePerStudent
} from '../lib/sessionHelpers';

const baseSession = (overrides: Partial<Session> = {}): Session => ({
  id: 'sess-test',
  studentIds: ['a', 'b'],
  date: new Date(2026, 4, 17, 14, 0).toISOString(),
  durationMinutes: 60,
  status: AttendanceStatus.Present,
  studentStatuses: [
    { studentId: 'a', status: AttendanceStatus.Present },
    { studentId: 'b', status: AttendanceStatus.Present }
  ],
  type: ClassType.Group,
  topic: 'Test',
  notes: '',
  price: 60,
  isTrial: false,
  ...overrides
});

describe('statusForStudent', () => {
  it('uses per-student status when present', () => {
    const s = baseSession({
      studentStatuses: [
        { studentId: 'a', status: AttendanceStatus.Present },
        { studentId: 'b', status: AttendanceStatus.Absent }
      ]
    });
    expect(statusForStudent(s, 'a')).toBe(AttendanceStatus.Present);
    expect(statusForStudent(s, 'b')).toBe(AttendanceStatus.Absent);
  });

  it('falls back to session-level status when no override', () => {
    const s = baseSession({ studentStatuses: [], status: AttendanceStatus.Late });
    expect(statusForStudent(s, 'a')).toBe(AttendanceStatus.Late);
  });
});

describe('isChargeableStatus', () => {
  it('charges Present and Late, not Absent or Cancelled', () => {
    expect(isChargeableStatus(AttendanceStatus.Present)).toBe(true);
    expect(isChargeableStatus(AttendanceStatus.Late)).toBe(true);
    expect(isChargeableStatus(AttendanceStatus.Absent)).toBe(false);
    expect(isChargeableStatus(AttendanceStatus.Cancelled)).toBe(false);
  });
});

describe('isTrialForStudent', () => {
  it('respects per-student trial override over session-level', () => {
    const s = baseSession({
      isTrial: false,
      studentStatuses: [
        { studentId: 'a', status: AttendanceStatus.Present, isTrial: true },
        { studentId: 'b', status: AttendanceStatus.Present }
      ]
    });
    expect(isTrialForStudent(s, 'a')).toBe(true);
    expect(isTrialForStudent(s, 'b')).toBe(false);
  });

  it('falls back to session-level isTrial when no per-student override', () => {
    const s = baseSession({ isTrial: true });
    expect(isTrialForStudent(s, 'a')).toBe(true);
  });
});

describe('isChargeableForStudent', () => {
  it('skips trial students entirely', () => {
    const s = baseSession({
      studentStatuses: [
        { studentId: 'a', status: AttendanceStatus.Present, isTrial: true },
        { studentId: 'b', status: AttendanceStatus.Present }
      ]
    });
    expect(isChargeableForStudent(s, 'a')).toBe(false);
    expect(isChargeableForStudent(s, 'b')).toBe(true);
  });

  it('treats Absent students as non-chargeable', () => {
    const s = baseSession({
      studentStatuses: [
        { studentId: 'a', status: AttendanceStatus.Absent },
        { studentId: 'b', status: AttendanceStatus.Present }
      ]
    });
    expect(isChargeableForStudent(s, 'a')).toBe(false);
    expect(isChargeableForStudent(s, 'b')).toBe(true);
  });
});

describe('pricePerStudent', () => {
  it('splits the session price evenly among non-trial students', () => {
    const s = baseSession({ price: 60, studentIds: ['a', 'b'] });
    expect(pricePerStudent(s, 'a')).toBe(30);
    expect(pricePerStudent(s, 'b')).toBe(30);
  });

  it('charges 0 for a trial student', () => {
    const s = baseSession({
      price: 60,
      studentStatuses: [
        { studentId: 'a', status: AttendanceStatus.Present, isTrial: true },
        { studentId: 'b', status: AttendanceStatus.Present }
      ]
    });
    expect(pricePerStudent(s, 'a')).toBe(0);
    // The non-trial student pays the full session price (no one to share with).
    expect(pricePerStudent(s, 'b')).toBe(60);
  });

  it('returns 0 if every student is trial', () => {
    const s = baseSession({
      price: 60,
      isTrial: true,
      studentStatuses: [
        { studentId: 'a', status: AttendanceStatus.Present, isTrial: true },
        { studentId: 'b', status: AttendanceStatus.Present, isTrial: true }
      ]
    });
    expect(pricePerStudent(s, 'a')).toBe(0);
    expect(pricePerStudent(s, 'b')).toBe(0);
  });
});

describe('balance delta accounting (simulating App.handleUpdateSession)', () => {
  it('removing then adding the same chargeable session is a net-zero delta', () => {
    const old = baseSession({ price: 40, studentIds: ['a'], studentStatuses: [{ studentId: 'a', status: AttendanceStatus.Present }] });
    const next = { ...old };

    const startingBalance = 0;
    // Reverse old
    const reverse = isChargeableForStudent(old, 'a') ? pricePerStudent(old, 'a') : 0;
    // Apply new
    const apply = isChargeableForStudent(next, 'a') ? pricePerStudent(next, 'a') : 0;
    expect(startingBalance - reverse + apply).toBe(0);
  });

  it('changing Present → Absent refunds the original charge', () => {
    const old = baseSession({ price: 40, studentIds: ['a'], studentStatuses: [{ studentId: 'a', status: AttendanceStatus.Present }] });
    const next = baseSession({ ...old, studentStatuses: [{ studentId: 'a', status: AttendanceStatus.Absent }] });

    const startingBalance = 40;
    const reverse = isChargeableForStudent(old, 'a') ? pricePerStudent(old, 'a') : 0;
    const apply = isChargeableForStudent(next, 'a') ? pricePerStudent(next, 'a') : 0;
    expect(startingBalance - reverse + apply).toBe(0);
  });
});
