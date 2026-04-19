import React from 'react';

export enum ClassType {
  OneOnOne = 'One-on-One',
  Group = 'One-on-Two'
}

export enum AttendanceStatus {
  Present = 'Present',
  Absent = 'Absent',
  Late = 'Late',
  Cancelled = 'Cancelled'
}

export type StudentStatus = 'Active' | 'Archived';

export interface ClassPackage {
  type: ClassType;
  total: number; // Total classes purchased
  active: boolean;
}

export interface SkillProgress {
  id: string;
  date: string; // ISO Date
  reading: number; // 0-100
  writing: number;
  listening: number;
  speaking: number;
  notes: string;
}

export interface Student {
  id: string;
  name: string;
  classTypes: ClassType[]; 
  email?: string;
  parentName?: string;
  notes: string;
  balance: number; 
  joinedDate: string;
  status: StudentStatus; 
  packages: ClassPackage[]; 
  progressHistory: SkillProgress[]; // Added progress tracking
}

export interface StudentSessionStatus {
  studentId: string;
  status: AttendanceStatus;
}

export interface Session {
  id: string;
  studentIds: string[];
  date: string; // ISO date string
  durationMinutes: number;
  status: AttendanceStatus; // General status for the session (summary)
  studentStatuses: StudentSessionStatus[]; // Individual status per student
  type: ClassType; 
  topic: string;
  notes: string;
  price: number;
}

export interface Payment {
  id: string;
  studentId: string;
  amount: number;
  date: string;
  method: string;
}

export interface TabItem {
  id: string;
  label: string;
  icon: React.ElementType;
}