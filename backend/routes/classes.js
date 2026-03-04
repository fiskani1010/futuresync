const express = require('express');
const router = express.Router();
const pool = require('../db');

function normalizeClassCode(value) {
    return String(value || '')
        .trim()
        .toUpperCase()
        .replace(/[^A-Z0-9_-]/g, '');
}

router.get('/', async (req, res) => {
    try {
        const teacherUsername = req.user?.username;
        const [rows] = await pool.query(
            `
            SELECT id, class_name, class_code, teacher_username, created_at
            FROM classes
            WHERE teacher_username = ?
            ORDER BY created_at DESC
            `,
            [teacherUsername]
        );
        res.json(rows);
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ error: 'Could not fetch classes' });
    }
});

router.post('/', async (req, res) => {
    try {
        const teacherUsername = req.user?.username;
        const className = String(req.body?.className || '').trim();
        const requestedClassCode = normalizeClassCode(req.body?.classCode);

        if (!className) {
            return res.status(400).json({ error: 'className is required' });
        }

        if (!requestedClassCode) {
            return res.status(400).json({ error: 'classCode is required' });
        }

        const [result] = await pool.query(
            `
            INSERT INTO classes (class_name, class_code, teacher_username)
            VALUES (?, ?, ?)
            `,
            [className, requestedClassCode, teacherUsername]
        );

        res.status(201).json({
            id: result.insertId,
            class_name: className,
            class_code: requestedClassCode,
            teacher_username: teacherUsername
        });
    } catch (err) {
        if (err.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ error: 'Class code already exists' });
        }
        console.error(err.message);
        res.status(500).json({ error: 'Could not create class' });
    }
});

module.exports = router;
