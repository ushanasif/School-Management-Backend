import httpStatus from "http-status";
import type { Prisma } from "../../../../generated/prisma/client";
import type { AttendanceStatus } from "../../../../generated/prisma/enums";
import { prisma } from "../../../../lib/prisma";
import { AppError } from "../../errorHandler/AppError";
import { checkPermission } from "../../middlewares/authorize";
import { dayKey, endOfBangladeshDay, todayInBangladesh } from "../../shared/scheduleSchemas";
import { dayStatus, eachDay, loadCalendar } from "../calendar/calendar.resolver";
import { resolveSectionHours } from "../schedule/schedule.service";
import { WORKING_STATUSES } from "../teacher/teacher.service";
import type {
  DayQuery,
  RangeQuery,
  RegisterQuery,
  SaveStudentSheetPayload,
  SaveTeacherSheetPayload,
  StudentSheetQuery,
  TeacherSheetQuery,
} from "./attendance.validation";

type Db = Prisma.TransactionClient;
type Auth = NonNullable<Express.Request["auth"]>;

const TX_OPTIONS = { maxWait: 10_000, timeout: 20_000 };
const DAY_MS = 86_400_000;
const EDIT_WINDOW_DAYS = 7;
const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

// ------------------------------------------------------------------- helpers

/*
 * Attendance can be taken or changed for today and the 7 days before it. Older days need
 * attendance:edit_past; future days never.
 */
const editWindow = async (auth: Auth, date: Date) => {
  const today = todayInBangladesh();
  if (date.getTime() > today.getTime()) return { editable: false, reason: "Attendance cannot be taken for a future date" };
  if (today.getTime() - date.getTime() <= EDIT_WINDOW_DAYS * DAY_MS) return { editable: true, reason: null };
  return (await checkPermission(auth, "attendance:edit_past")) === "OK"
    ? { editable: true, reason: null }
    : { editable: false, reason: `Attendance older than ${EDIT_WINDOW_DAYS} days can only be changed with special permission` };
};

const assertEditable = async (auth: Auth, date: Date) => {
  const window = await editWindow(auth, date);
  if (!window.editable) throw new AppError(window.reason!, httpStatus.FORBIDDEN);
};

const yearCovering = async (schoolId: string, date: Date) => {
  const year = await prisma.academicYear.findFirst({
    where: { schoolId, startDate: { lte: date }, endDate: { gte: date } },
    orderBy: { startDate: "desc" },
    select: { id: true, name: true },
  });
  if (!year) throw new AppError("No academic year covers this date", httpStatus.BAD_REQUEST);
  return year;
};

const findSection = async (schoolId: string, sectionId: string) => {
  const section = await prisma.section.findFirst({
    where: { id: sectionId, schoolId },
    select: { id: true, name: true, isDefault: true, classId: true, class: { select: { id: true, name: true } } },
  });
  if (!section) throw new AppError("Section not found", httpStatus.NOT_FOUND);
  return section;
};

const percent = (part: number, whole: number) => (whole === 0 ? null : Math.round((part / whole) * 10_000) / 100);

const emptyCounts = () => ({ PRESENT: 0, ABSENT: 0, LATE: 0, LEAVE: 0 }) as Record<AttendanceStatus, number>;

const tally = (statuses: AttendanceStatus[]) => {
  const counts = emptyCounts();
  for (const s of statuses) counts[s]++;
  const total = statuses.length;
  // late still means the student came
  return { ...counts, total, percentage: percent(counts.PRESENT + counts.LATE, total) };
};

/* "2", "10", "A-3": numbers in numeric order, students without a roll number last. */
const byRoll = (a: { rollNumber: string | null; name: string }, b: typeof a) => {
  if (a.rollNumber && b.rollNumber) {
    const c = a.rollNumber.localeCompare(b.rollNumber, undefined, { numeric: true });
    if (c !== 0) return c;
  } else if (a.rollNumber || b.rollNumber) {
    return a.rollNumber ? -1 : 1;
  }
  return a.name.localeCompare(b.name);
};

const studentBrief = {
  id: true,
  nameEn: true,
  nameBn: true,
  admissionNo: true,
  photo: true,
} satisfies Prisma.StudentSelect;

/*
 * The students on a section's roll on a date: enrolled in it that year by the end of the
 * day, and still there (active, or left on/after that day).
 */
const studentsOnRoll = async (db: Db, sectionId: string, academicYearId: string, date: Date) => {
  const enrollments = await db.enrollment.findMany({
    where: {
      sectionId,
      academicYearId,
      enrolledAt: { lt: endOfBangladeshDay(date) },
      OR: [{ status: "ACTIVE" }, { leftAt: { gte: date } }],
    },
    select: { id: true, rollNumber: true, student: { select: studentBrief } },
  });
  return enrollments
    .map((e) => ({ enrollmentId: e.id, rollNumber: e.rollNumber, student: e.student, name: e.student.nameEn }))
    .sort(byRoll);
};

/* Teachers who worked at the school on a date: joined by then, and not yet left. */
const teachersOnRoll = async (schoolId: string, date: Date) => {
  const teachers = await prisma.teacherProfile.findMany({
    where: {
      schoolId,
      OR: [{ joiningDate: null }, { joiningDate: { lte: date } }],
      AND: [{ OR: [{ status: { in: WORKING_STATUSES } }, { leftAt: { gte: date } }] }],
    },
    select: {
      id: true,
      designation: true,
      status: true,
      photo: true,
      membership: { select: { user: { select: { id: true, fullname: true, phone: true } } } },
    },
  });
  return teachers.sort((a, b) => a.membership.user.fullname.localeCompare(b.membership.user.fullname));
};

// ======================================================= student roll call

/*
 * The roll call of a section on a date: every student on the roll with what is saved.
 * Not yet saved students show PRESENT as the suggestion, so only absentees need marking.
 */
const getStudentSheet = async (auth: Auth, query: StudentSheetQuery) => {
  const schoolId = auth.schoolId!;
  const date = query.date ?? todayInBangladesh();
  const section = await findSection(schoolId, query.sectionId);
  const year = await yearCovering(schoolId, date);

  const [calendar, roll, session, window] = await Promise.all([
    loadCalendar(prisma, schoolId, date, date),
    studentsOnRoll(prisma, section.id, year.id, date),
    prisma.attendanceSession.findUnique({
      where: { sectionId_date: { sectionId: section.id, date } },
      include: { records: true },
    }),
    editWindow(auth, date),
  ]);
  const day = dayStatus(calendar, date, { classId: section.classId });
  const saved = new Map((session?.records ?? []).map((r) => [r.studentId, r]));

  const items = roll.map(({ name, ...entry }) => {
    const record = saved.get(entry.student.id);
    return {
      ...entry,
      status: record?.status ?? ("PRESENT" as const),
      note: record?.note ?? null,
      saved: record !== undefined,
      source: record?.source ?? null,
      checkInAt: record?.checkInAt ?? null,
      checkOutAt: record?.checkOutAt ?? null,
    };
  });

  return {
    date: dayKey(date),
    weekday: WEEKDAYS[date.getUTCDay()],
    academicYear: year,
    section,
    day,
    taken: session !== null,
    canTake: day.isSchoolDay && window.editable,
    cannotTakeReason: !day.isSchoolDay ? "This is not a school day for this class" : window.reason,
    session: session
      ? {
          id: session.id,
          startTime: session.startTime,
          endTime: session.endTime,
          scheduleNote: session.scheduleNote,
          takenBy: session.takenBy,
          updatedBy: session.updatedBy,
          createdAt: session.createdAt,
          updatedAt: session.updatedAt,
        }
      : null,
    summary: tally(items.map((i) => i.status)),
    items,
  };
};

/*
 * Saves a section's roll call for a day. Listed students get the given status; students
 * left out keep what they have, or become PRESENT on the first save. A manual entry always
 * replaces what a fingerprint machine recorded.
 */
const saveStudentSheet = async (auth: Auth, data: SaveStudentSheetPayload) => {
  const schoolId = auth.schoolId!;
  const { date } = data;
  const section = await findSection(schoolId, data.sectionId);
  const year = await yearCovering(schoolId, date);

  const calendar = await loadCalendar(prisma, schoolId, date, date);
  const day = dayStatus(calendar, date, { classId: section.classId });
  if (!day.isSchoolDay) {
    throw new AppError(
      `No attendance on a day off (${day.source?.nameEn ?? day.reason.replace("_", " ").toLowerCase()})`,
      httpStatus.BAD_REQUEST,
    );
  }
  await assertEditable(auth, date);

  await prisma.$transaction(async (tx) => {
    const roll = await studentsOnRoll(tx, section.id, year.id, date);
    const enrollmentOf = new Map(roll.map((r) => [r.student.id, r.enrollmentId]));
    if (data.records.some((r) => !enrollmentOf.has(r.studentId))) {
      throw new AppError("One or more students are not on this section's roll that day", httpStatus.BAD_REQUEST);
    }

    let session = await tx.attendanceSession.findUnique({
      where: { sectionId_date: { sectionId: section.id, date } },
      select: { id: true },
    });
    if (session) {
      await tx.attendanceSession.update({ where: { id: session.id }, data: { updatedBy: auth.userId } });
    } else {
      // the class hours of that day are copied in once, when the roll call is first taken
      const hours = (await resolveSectionHours(tx, schoolId, year.id, date, [section])).get(section.id)!;
      session = await tx.attendanceSession.create({
        data: {
          schoolId,
          academicYearId: year.id,
          sectionId: section.id,
          date,
          startTime: hours.startTime,
          endTime: hours.endTime,
          scheduleNote: hours.source.type === "OVERRIDE" ? hours.source.name : null,
          takenBy: auth.userId,
        },
        select: { id: true },
      });
    }

    const existing = new Map(
      (await tx.studentAttendance.findMany({ where: { sessionId: session.id } })).map((r) => [r.studentId, r]),
    );
    const given = new Map(data.records.map((r) => [r.studentId, r]));

    const creates: Prisma.StudentAttendanceCreateManyInput[] = [];
    for (const { student, enrollmentId } of roll) {
      const record = given.get(student.id);
      const saved = existing.get(student.id);

      if (!saved) {
        creates.push({
          sessionId: session.id,
          studentId: student.id,
          enrollmentId,
          status: record?.status ?? "PRESENT",
          note: record?.note ?? null,
          markedBy: auth.userId,
        });
      } else if (
        record &&
        (record.status !== saved.status || (record.note ?? null) !== saved.note || saved.source !== "MANUAL")
      ) {
        await tx.studentAttendance.update({
          where: { id: saved.id },
          data: { status: record.status, note: record.note ?? null, source: "MANUAL", markedBy: auth.userId },
        });
      }
    }
    if (creates.length > 0) await tx.studentAttendance.createMany({ data: creates });
  }, TX_OPTIONS);

  return getStudentSheet(auth, { sectionId: section.id, date });
};

// ======================================================= student reports

/* A day at a glance: every section's roll call (taken or not, counts), and teachers. */
const getDaySummary = async (schoolId: string, query: DayQuery) => {
  const date = query.date ?? todayInBangladesh();
  const year = await yearCovering(schoolId, date);

  const sections = await prisma.section.findMany({
    where: { schoolId, ...(query.classId ? { classId: query.classId } : {}) },
    orderBy: [{ class: { numericLevel: "asc" } }, { name: "asc" }],
    select: { id: true, name: true, isDefault: true, classId: true, class: { select: { id: true, name: true } } },
  });
  const sectionIds = sections.map((s) => s.id);

  const [calendar, onRoll, sessions, counts, teacherRecords, teacherRoll] = await Promise.all([
    loadCalendar(prisma, schoolId, date, date),
    prisma.enrollment.groupBy({
      by: ["sectionId"],
      where: {
        sectionId: { in: sectionIds },
        academicYearId: year.id,
        enrolledAt: { lt: endOfBangladeshDay(date) },
        OR: [{ status: "ACTIVE" }, { leftAt: { gte: date } }],
      },
      _count: { _all: true },
    }),
    prisma.attendanceSession.findMany({
      where: { schoolId, date, sectionId: { in: sectionIds } },
      select: { id: true, sectionId: true },
    }),
    prisma.studentAttendance.groupBy({
      by: ["sessionId", "status"],
      where: { session: { schoolId, date, sectionId: { in: sectionIds } } },
      _count: { _all: true },
    }),
    prisma.teacherAttendance.groupBy({
      by: ["status"],
      where: { schoolId, date },
      _count: { _all: true },
    }),
    teachersOnRoll(schoolId, date),
  ]);

  const rollBySection = new Map(onRoll.map((r) => [r.sectionId, r._count._all]));
  const sessionBySection = new Map(sessions.map((s) => [s.sectionId, s.id]));
  const countsBySession = new Map<string, Record<AttendanceStatus, number>>();
  for (const c of counts) {
    const entry = countsBySession.get(c.sessionId) ?? emptyCounts();
    entry[c.status] = c._count._all;
    countsBySession.set(c.sessionId, entry);
  }

  const totals = { onRoll: 0, ...emptyCounts(), sectionsTaken: 0, sectionsPending: 0 };
  const items = sections.map((section) => {
    const day = dayStatus(calendar, date, { classId: section.classId });
    const sessionId = sessionBySection.get(section.id);
    const sectionCounts = sessionId ? (countsBySession.get(sessionId) ?? emptyCounts()) : null;
    const roll = rollBySection.get(section.id) ?? 0;

    if (day.isSchoolDay && roll > 0) {
      totals.onRoll += roll;
      if (sectionCounts) {
        totals.sectionsTaken++;
        for (const s of Object.keys(sectionCounts) as AttendanceStatus[]) totals[s] += sectionCounts[s];
      } else {
        totals.sectionsPending++;
      }
    }

    return {
      section: { id: section.id, name: section.name, isDefault: section.isDefault },
      class: section.class,
      day,
      onRoll: roll,
      taken: sessionId !== undefined,
      counts: sectionCounts,
      percentage: sectionCounts ? percent(sectionCounts.PRESENT + sectionCounts.LATE, roll) : null,
    };
  });

  const teacherCounts = emptyCounts();
  for (const t of teacherRecords) teacherCounts[t.status] = t._count._all;

  return {
    date: dayKey(date),
    weekday: WEEKDAYS[date.getUTCDay()],
    academicYear: year,
    students: { ...totals, percentage: percent(totals.PRESENT + totals.LATE, totals.onRoll), sections: items },
    teachers: {
      day: dayStatus(calendar, date, "TEACHERS"),
      onRoll: teacherRoll.length,
      taken: teacherRecords.length > 0,
      ...teacherCounts,
    },
  };
};

/* Absent students of a day, with the guardian's phone (for calls now, SMS later). */
const getAbsentees = async (schoolId: string, query: DayQuery) => {
  const date = query.date ?? todayInBangladesh();

  const records = await prisma.studentAttendance.findMany({
    where: {
      status: "ABSENT",
      session: { schoolId, date, ...(query.classId ? { section: { classId: query.classId } } : {}) },
    },
    select: {
      note: true,
      enrollment: { select: { rollNumber: true } },
      student: {
        select: { ...studentBrief, guardianName: true, guardianPhone: true, phone: true, fatherName: true },
      },
      session: {
        select: {
          section: { select: { id: true, name: true, isDefault: true, class: { select: { id: true, name: true, numericLevel: true } } } },
        },
      },
    },
  });

  const items = records
    .map((r) => ({
      student: r.student,
      rollNumber: r.enrollment.rollNumber,
      note: r.note,
      class: r.session.section.class,
      section: { id: r.session.section.id, name: r.session.section.name, isDefault: r.session.section.isDefault },
      // the family login number, or the contact number when there is no login
      contactPhone: r.student.phone ?? r.student.guardianPhone,
    }))
    .sort(
      (a, b) =>
        a.class.numericLevel - b.class.numericLevel ||
        a.section.name.localeCompare(b.section.name) ||
        byRoll({ rollNumber: a.rollNumber, name: a.student.nameEn }, { rollNumber: b.rollNumber, name: b.student.nameEn }),
    );

  return { date: dayKey(date), total: items.length, items };
};

/* One student's attendance over a period: each day and the totals. */
const getStudentReport = async (schoolId: string, studentId: string, query: RangeQuery) => {
  const student = await prisma.student.findFirst({ where: { id: studentId, schoolId }, select: studentBrief });
  if (!student) throw new AppError("Student not found", httpStatus.NOT_FOUND);

  const records = await prisma.studentAttendance.findMany({
    where: { studentId, session: { schoolId, date: { gte: query.from, lte: query.to } } },
    orderBy: { session: { date: "asc" } },
    select: {
      status: true,
      note: true,
      source: true,
      checkInAt: true,
      session: { select: { date: true, section: { select: { id: true, name: true, class: { select: { id: true, name: true } } } } } },
    },
  });

  return {
    student,
    from: dayKey(query.from),
    to: dayKey(query.to),
    // percentage = (present + late) / days with a roll call
    summary: tally(records.map((r) => r.status)),
    days: records.map((r) => ({
      date: dayKey(r.session.date),
      status: r.status,
      note: r.note,
      source: r.source,
      checkInAt: r.checkInAt,
      section: r.session.section,
    })),
  };
};

/* The month register of a section: students by days, as in the paper register. */
const getSectionRegister = async (schoolId: string, sectionId: string, query: RegisterQuery) => {
  const section = await findSection(schoolId, sectionId);
  const [y, m] = query.month.split("-").map(Number);
  const from = new Date(Date.UTC(y, m - 1, 1));
  const to = new Date(Date.UTC(y, m, 0));

  const [calendar, sessions, enrollments] = await Promise.all([
    loadCalendar(prisma, schoolId, from, to),
    prisma.attendanceSession.findMany({
      where: { sectionId, date: { gte: from, lte: to } },
      select: { date: true, records: { select: { studentId: true, status: true } } },
    }),
    // everyone on the roll at some point in the month
    prisma.enrollment.findMany({
      where: {
        sectionId,
        academicYear: { startDate: { lte: to }, endDate: { gte: from } },
        enrolledAt: { lt: endOfBangladeshDay(to) },
        OR: [{ status: "ACTIVE" }, { leftAt: { gte: from } }],
      },
      select: { rollNumber: true, student: { select: studentBrief } },
    }),
  ]);

  const takenDays = new Set(sessions.map((s) => dayKey(s.date)));
  const statusOf = new Map<string, AttendanceStatus>();
  for (const s of sessions) for (const r of s.records) statusOf.set(`${r.studentId}:${dayKey(s.date)}`, r.status);

  const days = eachDay(from, to).map((d) => ({
    date: dayKey(d),
    weekday: WEEKDAYS[d.getUTCDay()],
    day: dayStatus(calendar, d, { classId: section.classId }),
    taken: takenDays.has(dayKey(d)),
  }));

  const students = enrollments
    .map((e) => ({ rollNumber: e.rollNumber, student: e.student, name: e.student.nameEn }))
    .sort(byRoll)
    .map(({ name, ...e }) => {
      const statuses: Record<string, AttendanceStatus | null> = {};
      for (const d of days) statuses[d.date] = statusOf.get(`${e.student.id}:${d.date}`) ?? null;
      return {
        ...e,
        statuses,
        summary: tally(Object.values(statuses).filter((s): s is AttendanceStatus => s !== null)),
      };
    });

  return { month: query.month, section, daysTaken: takenDays.size, days, students };
};

// ======================================================= teacher attendance

const getTeacherSheet = async (auth: Auth, query: TeacherSheetQuery) => {
  const schoolId = auth.schoolId!;
  const date = query.date ?? todayInBangladesh();

  const [calendar, teachers, records, window] = await Promise.all([
    loadCalendar(prisma, schoolId, date, date),
    teachersOnRoll(schoolId, date),
    prisma.teacherAttendance.findMany({ where: { schoolId, date } }),
    editWindow(auth, date),
  ]);
  const day = dayStatus(calendar, date, "TEACHERS");
  const saved = new Map(records.map((r) => [r.teacherId, r]));

  const items = teachers.map((teacher) => {
    const record = saved.get(teacher.id);
    return {
      teacher,
      // a teacher on leave is suggested as LEAVE, everyone else as PRESENT
      status: record?.status ?? (teacher.status === "ON_LEAVE" ? ("LEAVE" as const) : ("PRESENT" as const)),
      note: record?.note ?? null,
      saved: record !== undefined,
      source: record?.source ?? null,
      checkInAt: record?.checkInAt ?? null,
      checkOutAt: record?.checkOutAt ?? null,
    };
  });

  return {
    date: dayKey(date),
    weekday: WEEKDAYS[date.getUTCDay()],
    day,
    taken: records.length > 0,
    canTake: day.isSchoolDay && window.editable,
    cannotTakeReason: !day.isSchoolDay ? "Teachers are off this day" : window.reason,
    summary: tally(items.map((i) => i.status)),
    items,
  };
};

/* Same rules as the student roll call: listed teachers get the status, the rest keep theirs. */
const saveTeacherSheet = async (auth: Auth, data: SaveTeacherSheetPayload) => {
  const schoolId = auth.schoolId!;
  const { date } = data;

  const calendar = await loadCalendar(prisma, schoolId, date, date);
  const day = dayStatus(calendar, date, "TEACHERS");
  if (!day.isSchoolDay) throw new AppError("No attendance on a day teachers are off", httpStatus.BAD_REQUEST);
  await assertEditable(auth, date);

  const teachers = await teachersOnRoll(schoolId, date);
  const onRoll = new Map(teachers.map((t) => [t.id, t]));
  if (data.records.some((r) => !onRoll.has(r.teacherId))) {
    throw new AppError("One or more teachers did not work at the school that day", httpStatus.BAD_REQUEST);
  }

  await prisma.$transaction(async (tx) => {
    const existing = new Map((await tx.teacherAttendance.findMany({ where: { schoolId, date } })).map((r) => [r.teacherId, r]));
    const given = new Map(data.records.map((r) => [r.teacherId, r]));

    const creates: Prisma.TeacherAttendanceCreateManyInput[] = [];
    for (const teacher of teachers) {
      const record = given.get(teacher.id);
      const saved = existing.get(teacher.id);

      if (!saved) {
        creates.push({
          schoolId,
          teacherId: teacher.id,
          date,
          status: record?.status ?? (teacher.status === "ON_LEAVE" ? "LEAVE" : "PRESENT"),
          note: record?.note ?? null,
          markedBy: auth.userId,
        });
      } else if (
        record &&
        (record.status !== saved.status || (record.note ?? null) !== saved.note || saved.source !== "MANUAL")
      ) {
        await tx.teacherAttendance.update({
          where: { id: saved.id },
          data: { status: record.status, note: record.note ?? null, source: "MANUAL", markedBy: auth.userId },
        });
      }
    }
    if (creates.length > 0) await tx.teacherAttendance.createMany({ data: creates, skipDuplicates: true });
  }, TX_OPTIONS);

  return getTeacherSheet(auth, { date });
};

const getTeacherReport = async (schoolId: string, teacherId: string, query: RangeQuery) => {
  const teacher = await prisma.teacherProfile.findFirst({
    where: { id: teacherId, schoolId },
    select: { id: true, designation: true, status: true, membership: { select: { user: { select: { fullname: true, phone: true } } } } },
  });
  if (!teacher) throw new AppError("Teacher not found", httpStatus.NOT_FOUND);

  const records = await prisma.teacherAttendance.findMany({
    where: { teacherId, date: { gte: query.from, lte: query.to } },
    orderBy: { date: "asc" },
    select: { date: true, status: true, note: true, source: true, checkInAt: true, checkOutAt: true },
  });

  return {
    teacher,
    from: dayKey(query.from),
    to: dayKey(query.to),
    summary: tally(records.map((r) => r.status)),
    days: records.map((r) => ({ ...r, date: dayKey(r.date) })),
  };
};

export const AttendanceService = {
  getStudentSheet,
  saveStudentSheet,
  getDaySummary,
  getAbsentees,
  getStudentReport,
  getSectionRegister,
  getTeacherSheet,
  saveTeacherSheet,
  getTeacherReport,
};
