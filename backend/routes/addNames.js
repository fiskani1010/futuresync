const express = require('express');
const router = express.Router();
const pool = require('../db');


//a pathway to add a name to the database


router.post('/' , async(req,res)=>{

    try{
        const { name, registrationNumber, classCode } = req.body;
        const teacherUsername = req.user?.username;
        const normalizedRegistrationNumber = registrationNumber ? String(registrationNumber).trim() : null;
        const normalizedClassCode = String(classCode || '').trim().toUpperCase();
       
        if(!name){
            return res.status(400).json({error: "Name is required"});

        }
        if (!normalizedClassCode) {
            return res.status(400).json({ error: 'classCode is required' });
        }

        const [classRows] = await pool.query(
            'SELECT id FROM classes WHERE class_code = ? AND teacher_username = ? LIMIT 1',
            [normalizedClassCode, teacherUsername]
        );

        if (classRows.length === 0) {
            return res.status(404).json({ error: 'Class not found for this teacher' });
        }

        const [result] = await pool.query(
            'INSERT INTO students (name, registration_number, class_id) VALUES (?, ?, ?)',
            [name, normalizedRegistrationNumber || null, classRows[0].id]
        );
        res.json({
            message: "Name added successfully",
            id: result.insertId,
            name,
            registration_number: normalizedRegistrationNumber || null,
            class_code: normalizedClassCode
        });

    }
    catch(err){
        if (err.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ error: 'Registration number already exists in this class' });
        }
        console.error(err.message);
        res.status(500).send("Server Error");


    }



});

module.exports = router;
