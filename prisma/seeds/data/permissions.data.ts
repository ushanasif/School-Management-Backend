export interface PermissionSeed {
  code: string;       // "resource:action"
  name: string;
  description?: string;
  moduleCode: string; // links to ModuleSeed.code, not moduleId (resolved at seed time)
}

export const permissionsData: PermissionSeed[] = [
  // core
  { code: 'student:create', name: 'Create Student', moduleCode: 'core' },
  { code: 'student:view',   name: 'View Student',   moduleCode: 'core' },
  { code: 'student:update', name: 'Update Student',  moduleCode: 'core' },
  { code: 'student:delete', name: 'Delete Student',  moduleCode: 'core' },
  { code: 'staff:create',   name: 'Create Staff',    moduleCode: 'core' },
  { code: 'staff:view',     name: 'View Staff',      moduleCode: 'core' },
  { code: 'student:reset_password', name: 'Reset Guardian Password', moduleCode: 'core' },
  { code: 'academic_year:create', name: 'Create Academic Year', moduleCode: 'core' },
  { code: 'class:create',         name: 'Create Class',         moduleCode: 'core' },
  { code: 'section:create',       name: 'Create Section',       moduleCode: 'core' },
  { code: 'section:view',         name: 'View Sections',        moduleCode: 'core' },
  { code: 'section:update',       name: 'Rename Section',       moduleCode: 'core' },
  { code: 'section:delete',       name: 'Delete Section',       moduleCode: 'core' },
  { code: 'section:configure',    name: 'Set Section Class Teacher, Capacity and Class Hours', moduleCode: 'core' },
  { code: 'schedule:view',        name: 'View Class Hours and Schedule Changes', moduleCode: 'core' },
  { code: 'schedule:manage',      name: 'Manage Schedule Changes (Ramadan, Exam Day...)', moduleCode: 'core' },
  { code: 'subject:view',         name: 'View Subjects',        moduleCode: 'core' },
  { code: 'subject:create',       name: 'Create School Subject', moduleCode: 'core' },
  { code: 'subject:update',       name: 'Update School Subject', moduleCode: 'core' },
  { code: 'subject:delete',       name: 'Delete School Subject', moduleCode: 'core' },
  { code: 'class_subject:view',   name: 'View Class Subjects',  moduleCode: 'core' },
  { code: 'class_subject:manage', name: 'Assign Subjects to Classes', moduleCode: 'core' },
  { code: 'group:view',           name: 'View Groups',          moduleCode: 'core' },
  { code: 'group:create',         name: 'Create Group',         moduleCode: 'core' },
  { code: 'group:update',         name: 'Update Group',         moduleCode: 'core' },
  { code: 'group:delete',         name: 'Delete Group',         moduleCode: 'core' },
  { code: 'teacher:create',         name: 'Add Teacher',            moduleCode: 'core' },
  { code: 'teacher:view',           name: 'View Teachers',          moduleCode: 'core' },
  { code: 'teacher:update',         name: 'Update Teacher',         moduleCode: 'core' },
  { code: 'teacher:deactivate',     name: 'Deactivate Teacher',     moduleCode: 'core' },
  { code: 'teacher:reset_password', name: 'Reset Teacher Password', moduleCode: 'core' },
  { code: 'teacher:assign',         name: 'Assign Subject Teachers', moduleCode: 'core' },
  { code: 'holiday:view',           name: 'View Calendar and Holidays', moduleCode: 'core' },
  { code: 'holiday:manage',         name: 'Manage Weekly Holidays, Holidays and Working Days', moduleCode: 'core' },

  // attendance
  { code: 'attendance:mark',   name: 'Mark Attendance',   moduleCode: 'attendance' },
  { code: 'attendance:view',   name: 'View Attendance',   moduleCode: 'attendance' },
  { code: 'attendance:export', name: 'Export Attendance', moduleCode: 'attendance' },
  { code: 'attendance:edit_past', name: 'Change Attendance Older Than 7 Days', moduleCode: 'attendance' },
  { code: 'teacher_attendance:mark', name: 'Mark Teacher Attendance', moduleCode: 'attendance' },
  { code: 'teacher_attendance:view', name: 'View Teacher Attendance', moduleCode: 'attendance' },

  // exam
  { code: 'exam:create',         name: 'Create and Manage Exams, Routines and Optional Subjects', moduleCode: 'exam' },
  { code: 'exam:view',           name: 'View Exams and Routines', moduleCode: 'exam' },
  { code: 'exam:enter_marks',    name: 'Enter Marks for Any Section', moduleCode: 'exam' },
  { code: 'exam:unlock',         name: 'Unlock a Published Result', moduleCode: 'exam' },
  { code: 'exam:publish_result', name: 'Publish Result',       moduleCode: 'exam' },
  { code: 'exam:view_result',    name: 'View Result',          moduleCode: 'exam' },
  { code: 'grading:view',        name: 'View Grading Scales and Result Settings', moduleCode: 'exam' },
  { code: 'grading:manage',      name: 'Manage Grading Scales, Marks Setup and Result Settings', moduleCode: 'exam' },

  // library
  { code: 'library:manage_books', name: 'Manage Books', moduleCode: 'library' },
  { code: 'library:issue',        name: 'Issue Book',   moduleCode: 'library' },

  // transport
  { code: 'transport:manage_routes', name: 'Manage Routes', moduleCode: 'transport' },
  { code: 'transport:view',          name: 'View Transport', moduleCode: 'transport' },

    // finance: funds
  { code: 'fund:create',   name: 'Create Fund',            moduleCode: 'finance' },
  { code: 'fund:view',     name: 'View Funds',             moduleCode: 'finance' },
  { code: 'fund:update',   name: 'Update Fund',            moduleCode: 'finance' },
  { code: 'fund:deposit',  name: 'Add Money to Fund',      moduleCode: 'finance' },
  { code: 'fund:transfer', name: 'Transfer Between Funds', moduleCode: 'finance' },
  { code: 'fund:ledger',   name: 'View Fund Ledger',       moduleCode: 'finance' },

  // finance: fee setup
  { code: 'fee_type:create',      name: 'Create Fee Type',      moduleCode: 'finance' },
  { code: 'fee_type:view',        name: 'View Fee Types',       moduleCode: 'finance' },
  { code: 'fee_type:update',      name: 'Update Fee Type',      moduleCode: 'finance' },
  { code: 'fee_structure:create', name: 'Create Fee Structure', moduleCode: 'finance' },
  { code: 'fee_structure:view',   name: 'View Fee Structures',  moduleCode: 'finance' },
  { code: 'fee_structure:update', name: 'Update Fee Structure', moduleCode: 'finance' },

  // finance: student fees
  { code: 'student_fee:view',          name: 'View Student Fees',      moduleCode: 'finance' },
  { code: 'student_fee:create_custom', name: 'Add Custom Student Fee', moduleCode: 'finance' },
  { code: 'student_fee:discount',      name: 'Give Fee Discount',      moduleCode: 'finance' },

  // finance: payments
  { code: 'payment:create', name: 'Receive Payment', moduleCode: 'finance' },
  { code: 'payment:view',   name: 'View Payments',   moduleCode: 'finance' },
  { code: 'payment:cancel', name: 'Cancel Payment',  moduleCode: 'finance' },

  // finance: expenses and reports
  { code: 'expense:create',      name: 'Record Expense',       moduleCode: 'finance' },
  { code: 'expense:view',        name: 'View Expenses',        moduleCode: 'finance' },
  { code: 'expense:void', name: 'Void Expense', moduleCode: 'finance' },
  { code: 'finance_report:view', name: 'View Finance Reports', moduleCode: 'finance' },
];