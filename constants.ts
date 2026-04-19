import { Student, ClassType, Session, AttendanceStatus, Payment } from './types';

export const INITIAL_STUDENTS: Student[] = [
  {
    id: 's1',
    name: 'Alice Johnson',
    classTypes: [ClassType.OneOnOne, ClassType.Group],
    parentName: 'Martha Johnson',
    notes: 'Needs help with past tense verbs. Does group class on Fridays.',
    balance: 0,
    joinedDate: '2023-09-01',
    status: 'Active',
    packages: [
        { type: ClassType.OneOnOne, total: 10, active: true },
        { type: ClassType.Group, total: 5, active: true }
    ],
    progressHistory: [
        { id: 'ph1', date: '2023-09-01', reading: 60, writing: 55, listening: 70, speaking: 65, notes: 'Initial assessment.' },
        { id: 'ph2', date: '2023-10-01', reading: 65, writing: 60, listening: 75, speaking: 70, notes: 'Improving steadily.' }
    ]
  },
  {
    id: 's2',
    name: 'Bob Smith',
    classTypes: [ClassType.Group],
    parentName: 'John Smith',
    notes: 'Very energetic, likes games.',
    balance: -50,
    joinedDate: '2023-10-15',
    status: 'Active',
    packages: [
        { type: ClassType.Group, total: 20, active: true }
    ],
    progressHistory: [
        { id: 'ph3', date: '2023-10-15', reading: 50, writing: 45, listening: 80, speaking: 75, notes: 'Strong speaker, needs writing work.' }
    ]
  },
  {
    id: 's3',
    name: 'Charlie Davis',
    classTypes: [ClassType.Group],
    parentName: 'Sarah Davis',
    notes: 'Struggles with reading comprehension.',
    balance: 100,
    joinedDate: '2023-10-15',
    status: 'Active',
    packages: [
        { type: ClassType.Group, total: 20, active: true }
    ],
    progressHistory: []
  }
];

export const INITIAL_SESSIONS: Session[] = [
  {
    id: 'sess1',
    studentIds: ['s1'],
    date: '2023-10-25T14:00:00',
    durationMinutes: 60,
    status: AttendanceStatus.Present,
    studentStatuses: [{ studentId: 's1', status: AttendanceStatus.Present }],
    type: ClassType.OneOnOne,
    topic: 'Past Simple vs Continuous',
    notes: 'Great progress today.',
    price: 40
  },
  {
    id: 'sess2',
    studentIds: ['s2', 's3'],
    date: '2023-10-26T16:00:00',
    durationMinutes: 60,
    status: AttendanceStatus.Present,
    studentStatuses: [
        { studentId: 's2', status: AttendanceStatus.Present },
        { studentId: 's3', status: AttendanceStatus.Present }
    ],
    type: ClassType.Group,
    topic: 'Vocabulary: Animals',
    notes: 'Bob was distracted. Charlie did well.',
    price: 60 // 30 * 2
  },
  {
    id: 'sess3',
    studentIds: ['s1'],
    date: '2023-11-01T14:00:00',
    durationMinutes: 60,
    status: AttendanceStatus.Late,
    studentStatuses: [{ studentId: 's1', status: AttendanceStatus.Late }],
    type: ClassType.OneOnOne,
    topic: 'Future Tense',
    notes: 'Arrived 10 mins late.',
    price: 40
  }
];

export const INITIAL_PAYMENTS: Payment[] = [
  {
    id: 'p1',
    studentId: 's1',
    amount: 200,
    date: '2023-10-01',
    method: 'Bank Transfer'
  },
  {
    id: 'p2',
    studentId: 's2',
    amount: 150,
    date: '2023-10-15',
    method: 'Cash'
  }
];

export const PRICE_1ON1 = 40;
export const PRICE_GROUP = 30; // Per student