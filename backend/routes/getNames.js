const express = require('express');
const router = express.Router();
const pool = require('../db');



//a pathway to get all the names from the database

router.get('/' , async(req,res)=>{

    try{
        const { classCode } = req.query;
        const teacherUsername = req.user?.username;

        if (!classCode) {
            return res.status(400).json({ error: 'classCode is required' });
        }

        const [row] = await pool.query(
            `
            SELECT
                s.id,
                s.name,
                s.registration_number,
                s.coursework_1_score,
                s.coursework_2_score,
                s.coursework_3_score,
                s.final_exam_score,
                c.class_code
            FROM students s
            INNER JOIN classes c ON c.id = s.class_id
            WHERE c.class_code = ? AND c.teacher_username = ?
            ORDER BY s.id ASC
            `,
            [String(classCode).trim().toUpperCase(), teacherUsername]
        );
        res.json(row);

    }
    catch(err){
        console.error(err.message);
        res.status(500).send("Server Error");
    }

});

module.exports = router;
