const pool = require('../db');
const { hashPassword } = require('../utils/password');

function printUsage() {
    console.log('Usage: node scripts/create-admin-teacher.js "<username>" "<password>" [full-name] [email]');
    console.log('Example: node scripts/create-admin-teacher.js "admin@futuresync.com" "StrongPass!123" "Initial Admin"');
}

async function hasColumn(tableName, columnName) {
    const [rows] = await pool.query(
        `
        SELECT COLUMN_NAME
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = ?
          AND COLUMN_NAME = ?
        LIMIT 1
        `,
        [tableName, columnName]
    );
    return rows.length > 0;
}

async function main() {
    const username = String(process.argv[2] || '').trim();
    const password = String(process.argv[3] || '');
    const fullName = String(process.argv[4] || 'Initial Admin').trim();
    const emailArg = String(process.argv[5] || '').trim().toLowerCase();

    if (!username || !password) {
        printUsage();
        process.exit(1);
    }
    if (password.length < 8) {
        console.error('Password must be at least 8 characters.');
        process.exit(1);
    }

    try {
        const supportsEmail = await hasColumn('teachers', 'email');
        const { salt, hash } = hashPassword(password);
        const email = emailArg || (username.includes('@') ? username.toLowerCase() : null);

        const [existingRows] = await pool.query(
            'SELECT id FROM teachers WHERE LOWER(username) = LOWER(?) LIMIT 1',
            [username]
        );

        if (existingRows.length > 0) {
            const teacherId = existingRows[0].id;
            if (supportsEmail) {
                await pool.query(
                    `
                    UPDATE teachers
                    SET full_name = ?, email = ?, password_hash = ?, password_salt = ?, role = 'admin'
                    WHERE id = ?
                    `,
                    [fullName || null, email, hash, salt, teacherId]
                );
            } else {
                await pool.query(
                    `
                    UPDATE teachers
                    SET full_name = ?, password_hash = ?, password_salt = ?, role = 'admin'
                    WHERE id = ?
                    `,
                    [fullName || null, hash, salt, teacherId]
                );
            }
            console.log(`Admin teacher updated successfully. id=${teacherId}, username=${username}`);
        } else if (supportsEmail) {
            const [result] = await pool.query(
                `
                INSERT INTO teachers (username, email, full_name, password_hash, password_salt, role)
                VALUES (?, ?, ?, ?, ?, 'admin')
                `,
                [username, email, fullName || null, hash, salt]
            );
            console.log(`Admin teacher created successfully. id=${result.insertId}, username=${username}`);
        } else {
            const [result] = await pool.query(
                `
                INSERT INTO teachers (username, full_name, password_hash, password_salt, role)
                VALUES (?, ?, ?, ?, 'admin')
                `,
                [username, fullName || null, hash, salt]
            );
            console.log(`Admin teacher created successfully. id=${result.insertId}, username=${username}`);
        }
    } catch (err) {
        console.error('Failed to create/update admin teacher:', err.message);
        process.exitCode = 1;
    } finally {
        await pool.end();
    }
}

main();
