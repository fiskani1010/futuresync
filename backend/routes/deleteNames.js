const express = require('express');
const router = express.Router();
const pool = require('../db');

//a pathway to delete a name from the database

router.delete('/:id' , async(req,res)=>{   

    try{

        const {id} = req.params;
        const { classCode } = req.query;
        const teacherUsername = req.user?.username;

        if (!classCode) {
            return res.status(400).json({ error: 'classCode is required' });
        }

        const [result] = await pool.query(
            `
            DELETE s FROM students s
            INNER JOIN classes c ON c.id = s.class_id
            WHERE s.id = ? AND c.class_code = ? AND c.teacher_username = ?
            `,
            [id, String(classCode).trim().toUpperCase(), teacherUsername]
        );

        if(result.affectedRows === 0){
            return res.status(404).json({error: "Name not found"});
        }
        res.json({message: "Name deleted successfully"});

    }

    catch(err){
        console.error(err.message);
        res.status(500).send("cant delete name");
    }


});

module.exports = router;
