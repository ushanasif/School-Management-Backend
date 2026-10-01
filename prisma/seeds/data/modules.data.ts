import { ModuleType } from "../../../generated/prisma/enums";



export interface ModuleSeed {
  code: string;
  name: string;
  description?: string;
  type: ModuleType;
  price?: number;
}

export const modulesData: ModuleSeed[] = [
  { code: 'core', name: 'Core', description: 'Base school & user management', type: 'FREE' },
  { code: 'attendance', name: 'Attendance', description: 'Student & staff attendance', type: 'FREE' },
  { code: 'exam', name: 'Exam Management', description: 'Exams, results, report cards', type: 'FREE' },
  { code: 'finance', name: 'Finance', description: 'Funds, fees, payments, expenses & reports', type: 'FREE' },
  { code: 'library', name: 'Library', description: 'Book catalog & issue/return', type: 'PAID', price: 3000 },
  { code: 'transport', name: 'Transport', description: 'Bus routes & vehicle tracking', type: 'PAID', price: 4000 },
];