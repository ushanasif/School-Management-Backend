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

  // attendance
  { code: 'attendance:mark',   name: 'Mark Attendance',   moduleCode: 'attendance' },
  { code: 'attendance:view',   name: 'View Attendance',   moduleCode: 'attendance' },
  { code: 'attendance:export', name: 'Export Attendance', moduleCode: 'attendance' },

  // exam
  { code: 'exam:create',         name: 'Create Exam',          moduleCode: 'exam' },
  { code: 'exam:publish_result', name: 'Publish Result',       moduleCode: 'exam' },
  { code: 'exam:view_result',    name: 'View Result',          moduleCode: 'exam' },

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