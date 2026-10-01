import express from 'express';
import { schoolRoutes } from '../modules/school/school.route';
import { authRoutes } from '../modules/auth/auth.route';
import { studentRoutes } from '../modules/student/student.route';
import { academicYearRoute } from '../modules/academicYear/academicYear.route';
import { classRoutes } from '../modules/class/class.route';
import { sectionRoutes } from '../modules/section/section.route';


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
    }
];

moduleRoutes.forEach(route => router.use(route.path, route.route))

export default router;