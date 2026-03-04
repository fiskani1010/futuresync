const express = require('express');
const router = express.Router();
const pool = require('../db');

router.post('/', async (req, res) => {
    try {
        const name = String(req.body?.name || '').trim();
        const registrationNumber = String(req.body?.registrationNumber || '').trim();
        const classCode = String(req.body?.classCode || '').trim().toUpperCase();

        if (!name) {
            return res.status(400).json({ error: 'Name is required' });
        }

        if (!registrationNumber) {
            return res.status(400).json({ error: 'Registration number is required' });
        }
        if (!classCode) {
            return res.status(400).json({ error: 'Class code is required' });
        }

        const [classRows] = await pool.query(
            'SELECT id, class_name FROM classes WHERE class_code = ? LIMIT 1',
            [classCode]
        );

        if (classRows.length === 0) {
            return res.status(404).json({ error: 'Class code not found' });
        }

        const [result] = await pool.query(
            'INSERT INTO students (name, registration_number, class_id) VALUES (?, ?, ?)',
            [name, registrationNumber, classRows[0].id]
        );

        return res.status(201).json({
            message: 'Registration submitted successfully',
            id: result.insertId,
            name,
            registration_number: registrationNumber,
            class_code: classCode,
            class_name: classRows[0].class_name
        });
    } catch (err) {
        if (err.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ error: 'Registration number already exists in this class' });
        }
        console.error(err.message);
        return res.status(500).json({ error: 'Could not register student' });
    }
});

module.exports = router;
