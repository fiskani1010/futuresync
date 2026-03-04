const express = require('express');
const router = express.Router();
const pool = require('../db');

function parseScore(value, min, max, fieldName) {
    if (value === null || value === undefined || String(value).trim() === '') {
        return { ok: true, value: null };
    }

    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
        return { ok: false, error: `${fieldName} must be a number` };
    }
    if (parsed < min || parsed > max) {
        return { ok: false, error: `${fieldName} must be between ${min} and ${max}` };
    }

    return { ok: true, value: Number(parsed.toFixed(2)) };
}

function computeGrade(coursework1Score, coursework2Score, coursework3Score, finalExamScore) {
    if (
        coursework1Score === null ||
        coursework2Score === null ||
        coursework3Score === null ||
        finalExamScore === null
    ) {
        return { totalScore: null, letterGrade: null };
    }

    const totalScore = Number(((coursework1Score + coursework2Score + coursework3Score + finalExamScore) / 4).toFixed(2));
    let letterGrade = 'F';
    if (totalScore >= 80) letterGrade = 'A';
    else if (totalScore >= 70) letterGrade = 'B';
    else if (totalScore >= 60) letterGrade = 'C';
    else if (totalScore >= 50) letterGrade = 'D';
    return { totalScore, letterGrade };
}

router.get('/', async (req, res) => {
    try {
        const classCode = String(req.query?.classCode || '').trim().toUpperCase();
        const teacherUsername = req.user?.username;

        if (!classCode) {
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
                END AS letter_grade
            FROM students s
            INNER JOIN classes c ON c.id = s.class_id
            WHERE c.class_code = ? AND c.teacher_username = ?
            ORDER BY s.id ASC
            `,
            [classCode, teacherUsername]
        );

        return res.json(rows);
    } catch (err) {
        console.error(err.message);
        return res.status(500).json({ error: 'Could not fetch grades' });
    }
});

router.put('/:id', async (req, res) => {
    try {
        const studentId = Number(req.params.id);
        const classCode = String(req.body?.classCode || '').trim().toUpperCase();
        const teacherUsername = req.user?.username;

        if (!Number.isInteger(studentId) || studentId <= 0) {
            return res.status(400).json({ error: 'Valid student id is required' });
        }
        if (!classCode) {
            return res.status(400).json({ error: 'classCode is required' });
        }

        const courseworkOneResult = parseScore(req.body?.coursework1Score, 0, 100, 'coursework1Score');
        if (!courseworkOneResult.ok) {
            return res.status(400).json({ error: courseworkOneResult.error });
        }
        const courseworkTwoResult = parseScore(req.body?.coursework2Score, 0, 100, 'coursework2Score');
        if (!courseworkTwoResult.ok) {
            return res.status(400).json({ error: courseworkTwoResult.error });
        }
        const courseworkThreeResult = parseScore(req.body?.coursework3Score, 0, 100, 'coursework3Score');
        if (!courseworkThreeResult.ok) {
            return res.status(400).json({ error: courseworkThreeResult.error });
        }
        const finalExamResult = parseScore(req.body?.finalExamScore, 0, 100, 'finalExamScore');
        if (!finalExamResult.ok) {
            return res.status(400).json({ error: finalExamResult.error });
        }

        const [updateResult] = await pool.query(
            `
            UPDATE students s
            INNER JOIN classes c ON c.id = s.class_id
            SET
                s.coursework_1_score = ?,
                s.coursework_2_score = ?,
                s.coursework_3_score = ?,
                s.final_exam_score = ?
            WHERE s.id = ? AND c.class_code = ? AND c.teacher_username = ?
            `,
            [
                courseworkOneResult.value,
                courseworkTwoResult.value,
                courseworkThreeResult.value,
                finalExamResult.value,
                studentId,
                classCode,
                teacherUsername
            ]
        );

        if (updateResult.affectedRows === 0) {
            return res.status(404).json({ error: 'Student not found in this class' });
        }

        const [rows] = await pool.query(
            `
            SELECT
                s.id,
                s.coursework_1_score,
                s.coursework_2_score,
                s.coursework_3_score,
                s.final_exam_score
            FROM students s
            INNER JOIN classes c ON c.id = s.class_id
            WHERE s.id = ? AND c.class_code = ? AND c.teacher_username = ?
            LIMIT 1
            `,
            [studentId, classCode, teacherUsername]
        );

        if (rows.length === 0) {
            return res.status(404).json({ error: 'Student not found after update' });
        }

        const student = rows[0];
        const { totalScore, letterGrade } = computeGrade(
            student.coursework_1_score,
            student.coursework_2_score,
            student.coursework_3_score,
            student.final_exam_score
        );
        return res.json({
            message: 'Grades saved successfully',
            student: {
                id: student.id,
                coursework_1_score: student.coursework_1_score,
                coursework_2_score: student.coursework_2_score,
                coursework_3_score: student.coursework_3_score,
                final_exam_score: student.final_exam_score,
                overall_score: totalScore,
                letter_grade: letterGrade
            }
        });
    } catch (err) {
        console.error(err.message);
        return res.status(500).json({ error: 'Could not save grades' });
    }
});

module.exports = router;
