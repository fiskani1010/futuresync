const express = require('express');
const router = express.Router();
const pool = require('../db');

// Update a student’s name by ID (Edit)
router.put('/:id', async (req, res) => {
    try {
        const { id } = req.params;        // Get student ID from URL
        const { name, registrationNumber, classCode } = req.body;        // Get new values from request body
        const teacherUsername = req.user?.username;
        const normalizedRegistrationNumber = registrationNumber ? String(registrationNumber).trim() : null;
        const normalizedClassCode = String(classCode || '').trim().toUpperCase();

        if (!name) {
            return res.status(400).json({ error: "Name is required" });
        }
        if (!normalizedClassCode) {
            return res.status(400).json({ error: 'classCode is required' });
        }

        const [result] = await pool.query(
            `
            UPDATE students s
            INNER JOIN classes c ON c.id = s.class_id
            SET s.name = ?, s.registration_number = ?
            WHERE s.id = ? AND c.class_code = ? AND c.teacher_username = ?
            `,
            [name, normalizedRegistrationNumber || null, id, normalizedClassCode, teacherUsername]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: "Student not found" });
        }

        res.json({
            message: `Student with ID ${id} updated successfully`,
            id,
            name,
            registration_number: normalizedRegistrationNumber || null,
            class_code: normalizedClassCode
        });
    } catch (err) {
        if (err.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ error: 'Registration number already exists in this class' });
        }
        console.error(err.message);
        res.status(500).json({ error: "Can't update student", details: err.message });
    }
});

module.exports = router;
