import express from 'express';
import { schoolRoutes } from '../modules/school/school.route';
import { authRoutes } from '../modules/auth/auth.route';
import { studentRoutes } from '../modules/student/student.route';
import { academicYearRoute } from '../modules/academicYear/academicYear.route';
import { classRoutes } from '../modules/class/class.route';
import { sectionRoutes } from '../modules/section/section.route';
import { scheduleRoutes } from '../modules/schedule/schedule.route';
import { platformSubjectRoutes, subjectRoutes } from '../modules/subject/subject.route';
import { classSubjectRoutes } from '../modules/classSubject/classSubject.route';
import { groupRoutes } from '../modules/group/group.route';
import { teacherRoutes } from '../modules/teacher/teacher.route';
import { subjectTeacherRoutes } from '../modules/subjectTeacher/subjectTeacher.route';
import { calendarRoutes, nationalHolidayRoutes } from '../modules/calendar/calendar.route';
import { attendanceRoutes } from '../modules/attendance/attendance.route';
import { gradingRoutes } from '../modules/grading/grading.route';
import { examRoutes, optionalSubjectRoutes } from '../modules/exam/exam.route';
import { examMarksRoutes } from '../modules/exam/examMarks.route';
import { examResultRoutes } from '../modules/exam/examResult.route';
import { finalResultRoutes } from '../modules/exam/finalResult.route';


const router = express.Router();

const moduleRoutes = [
    
    {
        path: '/school',
        route: schoolRoutes
    },
    {
        path: '/auth',
        route: authRoutes
    },
    {
        path: '/student',
        route: studentRoutes
    },
    {
        path: '/academic-year',
        route: academicYearRoute
    },
    {
        path: '/class',
        route: classRoutes
    },
    {
        path: '/section',
        route: sectionRoutes
    },
    {
        path: '/schedule',
        route: scheduleRoutes
    },
    {
        path: '/subject',
        route: subjectRoutes
    },
    {
        // the shared NCTB subject list, platform admin only
        path: '/platform/subject',
        route: platformSubjectRoutes
    },
    {
        path: '/class-subject',
        route: classSubjectRoutes
    },
    {
        path: '/group',
        route: groupRoutes
    },
    {
        path: '/teacher',
        route: teacherRoutes
    },
    {
        path: '/subject-teacher',
        route: subjectTeacherRoutes
    },
    {
        path: '/calendar',
        route: calendarRoutes
    },
    {
        // national holidays for every school, platform admin only
        path: '/platform/national-holiday',
        route: nationalHolidayRoutes
    },
    {
        path: '/attendance',
        route: attendanceRoutes
    },
    {
        path: '/grading',
        route: gradingRoutes
    },
    {
        path: '/exam',
        route: examRoutes
    },
    {
        // students' optional (4th) subject
        path: '/optional-subject',
        route: optionalSubjectRoutes
    },
    {
        path: '/exam-marks',
        route: examMarksRoutes
    },
    {
        path: '/exam-results',
        route: examResultRoutes
    },
    {
        // results made from several exams (term / annual), each school's own formula
        path: '/final-results',
        route: finalResultRoutes
    }
];

moduleRoutes.forEach(route => router.use(route.path, route.route))

export default router;