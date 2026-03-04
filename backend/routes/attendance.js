const express = require('express');
const router = express.Router();
const pool = require('../db');

const ALLOWED_STATUS = new Set(['present', 'late', 'absent']);

router.get('/final-register', async (req, res) => {
    try {
        const { from, to, classCode } = req.query;
        const teacherUsername = req.user?.username;
        const fromDate = from || null;
        const toDate = to || null;
        const normalizedClassCode = String(classCode || '').trim().toUpperCase();

        if (!normalizedClassCode) {
            return res.status(400).json({ error: 'classCode is required' });
        }

        const [rows] = await pool.query(
            `
            SELECT
                s.id,
                s.name,
                s.registration_number,
                s.coursework_1_score,
                s.coursework_2_score,
                s.coursework_3_score,
                s.final_exam_score,
                CASE
                    WHEN s.coursework_1_score IS NULL
                      OR s.coursework_2_score IS NULL
                      OR s.coursework_3_score IS NULL
                      OR s.final_exam_score IS NULL
                    THEN NULL
                    ELSE ROUND(
                        (s.coursework_1_score + s.coursework_2_score + s.coursework_3_score + s.final_exam_score) / 4,
                        2
                    )
                END AS overall_score,
                CASE
                    WHEN s.coursework_1_score IS NULL
                      OR s.coursework_2_score IS NULL
                      OR s.coursework_3_score IS NULL
                      OR s.final_exam_score IS NULL
                    THEN NULL
                    WHEN ((s.coursework_1_score + s.coursework_2_score + s.coursework_3_score + s.final_exam_score) / 4) >= 80 THEN 'A'
                    WHEN ((s.coursework_1_score + s.coursework_2_score + s.coursework_3_score + s.final_exam_score) / 4) >= 70 THEN 'B'
                    WHEN ((s.coursework_1_score + s.coursework_2_score + s.coursework_3_score + s.final_exam_score) / 4) >= 60 THEN 'C'
                    WHEN ((s.coursework_1_score + s.coursework_2_score + s.coursework_3_score + s.final_exam_score) / 4) >= 50 THEN 'D'
                    ELSE 'F'
                END AS letter_grade,
                COALESCE(SUM(CASE WHEN a.status = 'present' THEN 1 ELSE 0 END), 0) AS present_days,
                COALESCE(SUM(CASE WHEN a.status = 'late' THEN 1 ELSE 0 END), 0) AS late_days,
                COALESCE(SUM(CASE WHEN a.status = 'absent' THEN 1 ELSE 0 END), 0) AS absent_days,
                COALESCE(COUNT(a.id), 0) AS marked_days
            FROM students s
            INNER JOIN classes c ON c.id = s.class_id
            LEFT JOIN attendance a
                ON a.student_id = s.id
                AND (? IS NULL OR a.attendance_date >= ?)
                AND (? IS NULL OR a.attendance_date <= ?)
            WHERE c.class_code = ? AND c.teacher_username = ?
            GROUP BY
                s.id,
                s.name,
                s.registration_number,
                s.coursework_1_score,
                s.coursework_2_score,
                s.coursework_3_score,
                s.final_exam_score
            ORDER BY s.id ASC
            `,
            [fromDate, fromDate, toDate, toDate, normalizedClassCode, teacherUsername]
        );

        const [daysResult] = await pool.query(
            `
            SELECT COUNT(DISTINCT attendance_date) AS total_days
            FROM attendance a
            INNER JOIN students s ON s.id = a.student_id
            INNER JOIN classes c ON c.id = s.class_id
            WHERE c.class_code = ? AND c.teacher_username = ?
              AND (? IS NULL OR attendance_date >= ?)
              AND (? IS NULL OR attendance_date <= ?)
            `,
            [normalizedClassCode, teacherUsername, fromDate, fromDate, toDate, toDate]
        );

        res.json({
            range: { from: fromDate, to: toDate },
            total_days: Number(daysResult?.[0]?.total_days || 0),
            rows
        });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ error: 'Unable to fetch final register' });
    }
});

router.get('/', async (req, res) => {
    try {
        const { date, classCode } = req.query;
        const teacherUsername = req.user?.username;
        const normalizedClassCode = String(classCode || '').trim().toUpperCase();

        if (!date || !normalizedClassCode) {
            return res.status(400).json({ error: 'date and classCode query parameters are required' });
        }

        const [rows] = await pool.query(
            `
            SELECT s.id, s.name, s.registration_number, a.status
            FROM students s
            INNER JOIN classes c ON c.id = s.class_id
            LEFT JOIN attendance a
            ON a.student_id = s.id AND a.attendance_date = ?
            WHERE c.class_code = ? AND c.teacher_username = ?
            ORDER BY s.id ASC
            `,
            [date, normalizedClassCode, teacherUsername]
        );

        res.json(rows);
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ error: 'Unable to fetch attendance' });
    }
});

router.put('/', async (req, res) => {
    try {
        const { studentId, date, status, classCode } = req.body;
        const teacherUsername = req.user?.username;
        const normalizedClassCode = String(classCode || '').trim().toUpperCase();

        if (!studentId || !date || !status || !normalizedClassCode) {
            return res.status(400).json({ error: 'studentId, date, status, and classCode are required' });
        }

        if (!ALLOWED_STATUS.has(status)) {
            return res.status(400).json({ error: 'status must be one of: present, late, absent' });
        }

        const [ownershipRows] = await pool.query(
            `
            SELECT s.id
            FROM students s
            INNER JOIN classes c ON c.id = s.class_id
            WHERE s.id = ? AND c.class_code = ? AND c.teacher_username = ?
            LIMIT 1
            `,
            [studentId, normalizedClassCode, teacherUsername]
        );

        if (ownershipRows.length === 0) {
            return res.status(404).json({ error: 'Student not found in this class' });
        }

        await pool.query(
            `
            INSERT INTO attendance (student_id, attendance_date, status)
            VALUES (?, ?, ?)
            ON DUPLICATE KEY UPDATE status = VALUES(status), updated_at = CURRENT_TIMESTAMP
            `,
            [studentId, date, status]
        );

        res.json({ message: 'Attendance saved', studentId, date, status, classCode: normalizedClassCode });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ error: 'Unable to save attendance' });
    }
});

router.delete('/', async (req, res) => {
    try {
        const { studentId, date, classCode } = req.body;
        const teacherUsername = req.user?.username;
        const normalizedClassCode = String(classCode || '').trim().toUpperCase();

        if (!studentId || !date || !normalizedClassCode) {
            return res.status(400).json({ error: 'studentId, date, and classCode are required' });
        }

        const [ownershipRows] = await pool.query(
            `
            SELECT s.id
            FROM students s
            INNER JOIN classes c ON c.id = s.class_id
            WHERE s.id = ? AND c.class_code = ? AND c.teacher_username = ?
            LIMIT 1
            `,
            [studentId, normalizedClassCode, teacherUsername]
        );

        if (ownershipRows.length === 0) {
            return res.status(404).json({ error: 'Student not found in this class' });
        }

        await pool.query(
            'DELETE FROM attendance WHERE student_id = ? AND attendance_date = ?',
            [studentId, date]
        );

        res.json({ message: 'Attendance cleared', studentId, date, classCode: normalizedClassCode });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ error: 'Unable to clear attendance' });
    }
});

module.exports = router;
