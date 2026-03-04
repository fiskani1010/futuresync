const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const express = require('express');
const cors = require('cors');
const pool = require('./db');
const requireAuth = require('./middleware/authMiddleware');
const { hashPassword } = require('./utils/password');


const app = express();

const isProduction = process.env.NODE_ENV === 'production';
const allowedOrigins = String(process.env.CORS_ORIGIN || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

const corsOptions = {
    origin(origin, callback) {
        if (!origin) {
            return callback(null, true);
        }
        if (allowedOrigins.length === 0) {
            return callback(null, !isProduction);
        }
        return callback(null, allowedOrigins.includes(origin));
    }
};

app.use(cors(corsOptions));
app.use(express.json());


const PORT = process.env.PORT || 3000;

if (isProduction && !process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET is required in production');
}

app.get('/health', async (req, res) => {
    try {
        await pool.query('SELECT 1');
        return res.json({ status: 'ok' });
    } catch (err) {
        return res.status(503).json({ status: 'error', error: 'database unavailable' });
    }
});

//auth route (public)
const authRoute = require('./routes/auth');
app.use('/api/auth', authRoute);
app.use('/api/teachers', authRoute);

//student self-registration route (public)
const publicRegistrationRoute = require('./routes/publicRegistration');
app.use('/api/public/register', publicRegistrationRoute);

//protect all routes under /api except /api/auth
app.use('/api', requireAuth);

//class routes
const classesRoute = require('./routes/classes');
app.use('/api/classes', classesRoute);

//getting all the names from the database
const getNamesRoute = require('./routes/getNames');
app.use('/api/names', getNamesRoute);

//adding a name to the database
const addNamesRoute = require('./routes/addNames');
app.use('/api/add-name', addNamesRoute);

//deleting a name from the database
const deleteNamesRoute = require('./routes/deleteNames');
app.use('/api/delete-name', deleteNamesRoute);

//updating a name in the database
const updateNamesRoute = require('./routes/editNames');
app.use('/api/update-name', updateNamesRoute);

//attendance routes
const attendanceRoute = require('./routes/attendance');
app.use('/api/attendance', attendanceRoute);

//grades routes
const gradesRoute = require('./routes/grades');
app.use('/api/grades', gradesRoute);

async function initializeDatabase() {
    await pool.query(`
        CREATE TABLE IF NOT EXISTS teachers (
            id INT AUTO_INCREMENT PRIMARY KEY,
            username VARCHAR(120) NOT NULL UNIQUE,
            email VARCHAR(160) NULL,
            full_name VARCHAR(160) NULL,
            password_hash CHAR(128) NOT NULL,
            password_salt CHAR(32) NOT NULL,
            role ENUM('admin', 'lecturer') NOT NULL DEFAULT 'lecturer',
            created_by_admin_id INT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `);

    const [roleColumnRows] = await pool.query(
        `
        SELECT COLUMN_NAME
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'teachers'
          AND COLUMN_NAME = 'role'
        `
    );
    if (roleColumnRows.length === 0) {
        await pool.query("ALTER TABLE teachers ADD COLUMN role ENUM('admin','lecturer') NOT NULL DEFAULT 'lecturer'");
    }

    const [createdByColumnRows] = await pool.query(
        `
        SELECT COLUMN_NAME
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'teachers'
          AND COLUMN_NAME = 'created_by_admin_id'
        `
    );
    if (createdByColumnRows.length === 0) {
        await pool.query('ALTER TABLE teachers ADD COLUMN created_by_admin_id INT NULL');
    }

    const [emailColumnRows] = await pool.query(
        `
        SELECT COLUMN_NAME
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'teachers'
          AND COLUMN_NAME = 'email'
        `
    );
    if (emailColumnRows.length === 0) {
        await pool.query('ALTER TABLE teachers ADD COLUMN email VARCHAR(160) NULL');
    }

    const [emailIndexRows] = await pool.query(
        `
        SELECT INDEX_NAME
        FROM INFORMATION_SCHEMA.STATISTICS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'teachers'
          AND INDEX_NAME = 'uniq_teacher_email'
        `
    );
    if (emailIndexRows.length === 0) {
        await pool.query('ALTER TABLE teachers ADD UNIQUE KEY uniq_teacher_email (email)');
    }

    const [teacherAdminFkRows] = await pool.query(
        `
        SELECT CONSTRAINT_NAME
        FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'teachers'
          AND COLUMN_NAME = 'created_by_admin_id'
          AND REFERENCED_TABLE_NAME = 'teachers'
        `
    );
    if (teacherAdminFkRows.length === 0) {
        await pool.query(`
            ALTER TABLE teachers
            ADD CONSTRAINT fk_teachers_created_by_admin
            FOREIGN KEY (created_by_admin_id) REFERENCES teachers(id)
            ON DELETE SET NULL
        `);
    }

    const bootstrapUsername = process.env.TEACHER_USERNAME || 'teacher';
    const bootstrapPassword = String(process.env.TEACHER_PASSWORD || '');
    if (!bootstrapPassword) {
        console.warn('TEACHER_PASSWORD not set. Bootstrap admin auto-creation is disabled.');
    }
    const [teacherRows] = await pool.query(
        'SELECT id FROM teachers WHERE username = ? LIMIT 1',
        [bootstrapUsername]
    );
    if (teacherRows.length === 0) {
        if (bootstrapPassword) {
            const { salt, hash } = hashPassword(bootstrapPassword);
            await pool.query(
                `
                INSERT INTO teachers (username, full_name, password_hash, password_salt, role)
                VALUES (?, ?, ?, ?, 'admin')
                `,
                [bootstrapUsername, 'Default Teacher', hash, salt]
            );
        } else {
            console.warn(`No bootstrap admin created for username "${bootstrapUsername}". Create an admin user manually.`);
        }
    } else {
        if (bootstrapPassword) {
            await pool.query('UPDATE teachers SET role = "admin" WHERE username = ? AND role <> "admin"', [bootstrapUsername]);
        }
    }

    await pool.query(`
        CREATE TABLE IF NOT EXISTS password_resets (
            id INT AUTO_INCREMENT PRIMARY KEY,
            teacher_id INT NOT NULL,
            token_hash CHAR(64) NOT NULL,
            expires_at DATETIME NOT NULL,
            used_at DATETIME NULL,
            created_by_admin_id INT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_teacher_resets (teacher_id),
            INDEX idx_token_hash (token_hash),
            CONSTRAINT fk_password_resets_teacher
                FOREIGN KEY (teacher_id) REFERENCES teachers(id) ON DELETE CASCADE,
            CONSTRAINT fk_password_resets_admin
                FOREIGN KEY (created_by_admin_id) REFERENCES teachers(id) ON DELETE CASCADE
        )
    `);

    await pool.query(`
        CREATE TABLE IF NOT EXISTS classes (
            id INT AUTO_INCREMENT PRIMARY KEY,
            class_name VARCHAR(120) NOT NULL,
            class_code VARCHAR(32) NOT NULL UNIQUE,
            teacher_username VARCHAR(120) NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `);

    await pool.query(`
        CREATE TABLE IF NOT EXISTS students (
            id INT AUTO_INCREMENT PRIMARY KEY,
            name VARCHAR(160) NOT NULL,
            registration_number VARCHAR(64) NULL,
            class_id INT NULL,
            coursework_1_score DECIMAL(5,2) NULL,
            coursework_2_score DECIMAL(5,2) NULL,
            coursework_3_score DECIMAL(5,2) NULL,
            final_exam_score DECIMAL(5,2) NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `);

    const [registrationColumn] = await pool.query(
        `
        SELECT COLUMN_NAME
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'students'
          AND COLUMN_NAME = 'registration_number'
        `
    );

    if (registrationColumn.length === 0) {
        await pool.query('ALTER TABLE students ADD COLUMN registration_number VARCHAR(64) NULL');
    }

    const [classIdColumn] = await pool.query(
        `
        SELECT COLUMN_NAME
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'students'
          AND COLUMN_NAME = 'class_id'
        `
    );

    if (classIdColumn.length === 0) {
        await pool.query('ALTER TABLE students ADD COLUMN class_id INT NULL');
    }

    const [courseworkOneColumn] = await pool.query(
        `
        SELECT COLUMN_NAME
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'students'
          AND COLUMN_NAME = 'coursework_1_score'
        `
    );
    if (courseworkOneColumn.length === 0) {
        await pool.query('ALTER TABLE students ADD COLUMN coursework_1_score DECIMAL(5,2) NULL');
    }

    const [courseworkTwoColumn] = await pool.query(
        `
        SELECT COLUMN_NAME
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'students'
          AND COLUMN_NAME = 'coursework_2_score'
        `
    );
    if (courseworkTwoColumn.length === 0) {
        await pool.query('ALTER TABLE students ADD COLUMN coursework_2_score DECIMAL(5,2) NULL');
    }

    const [courseworkThreeColumn] = await pool.query(
        `
        SELECT COLUMN_NAME
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'students'
          AND COLUMN_NAME = 'coursework_3_score'
        `
    );
    if (courseworkThreeColumn.length === 0) {
        await pool.query('ALTER TABLE students ADD COLUMN coursework_3_score DECIMAL(5,2) NULL');
    }

    const [finalExamColumn] = await pool.query(
        `
        SELECT COLUMN_NAME
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'students'
          AND COLUMN_NAME = 'final_exam_score'
        `
    );
    if (finalExamColumn.length === 0) {
        await pool.query('ALTER TABLE students ADD COLUMN final_exam_score DECIMAL(5,2) NULL');
    }

    const [legacyRegistrationIndex] = await pool.query(
        `
        SELECT INDEX_NAME
        FROM INFORMATION_SCHEMA.STATISTICS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'students'
          AND INDEX_NAME = 'uniq_registration_number'
        `
    );

    if (legacyRegistrationIndex.length > 0) {
        await pool.query('ALTER TABLE students DROP INDEX uniq_registration_number');
    }

    const [classRegistrationIndex] = await pool.query(
        `
        SELECT INDEX_NAME
        FROM INFORMATION_SCHEMA.STATISTICS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'students'
          AND INDEX_NAME = 'uniq_class_registration'
        `
    );

    if (classRegistrationIndex.length === 0) {
        await pool.query('ALTER TABLE students ADD UNIQUE KEY uniq_class_registration (class_id, registration_number)');
    }

    const [classForeignKey] = await pool.query(
        `
        SELECT CONSTRAINT_NAME
        FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'students'
          AND COLUMN_NAME = 'class_id'
          AND REFERENCED_TABLE_NAME = 'classes'
        `
    );

    if (classForeignKey.length === 0) {
        await pool.query(
            `
            ALTER TABLE students
            ADD CONSTRAINT fk_students_class
            FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE
            `
        );
    }

    await pool.query(`
        CREATE TABLE IF NOT EXISTS attendance (
            id INT AUTO_INCREMENT PRIMARY KEY,
            student_id INT NOT NULL,
            attendance_date DATE NOT NULL,
            status ENUM('present', 'late', 'absent') NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            UNIQUE KEY uniq_student_date (student_id, attendance_date),
            CONSTRAINT fk_attendance_student FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
        )
    `);
}

initializeDatabase()
    .then(() => {
        app.listen(PORT, () => {
            console.log(`Server is running on port ${PORT}`);
        });
    })
    .catch((error) => {
        console.error('Failed to initialize database:', error.message);
        process.exit(1);
    });
