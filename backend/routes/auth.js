const crypto = require('crypto');
const express = require('express');
const router = express.Router();
const { createToken, verifyToken } = require('../utils/authToken');
const { hashPassword, verifyPassword, isBcryptHash } = require('../utils/password');
const pool = require('../db');

function normalizeEmail(value) {
    return String(value || '').trim().toLowerCase();
}

function normalizeIdentifier(value) {
    return String(value || '').trim();
}

async function requireAdmin(req, res) {
    const authHeader = req.headers.authorization || '';
    const [scheme, token] = authHeader.split(' ');
    if (scheme !== 'Bearer' || !token) {
        res.status(401).json({ error: 'Unauthorized' });
        return null;
    }

    const payload = verifyToken(token);
    if (!payload?.username) {
        res.status(401).json({ error: 'Invalid or expired token' });
        return null;
    }

    const [rows] = await pool.query(
        'SELECT id, username, role FROM teachers WHERE username = ? LIMIT 1',
        [payload.username]
    );
    if (rows.length === 0) {
        res.status(401).json({ error: 'Teacher not found' });
        return null;
    }
    if (rows[0].role !== 'admin') {
        res.status(403).json({ error: 'Admin access required' });
        return null;
    }
    return rows[0];
}

router.post('/register', async (req, res) => {
    try {
        const name = String(req.body?.name || req.body?.fullName || '').trim();
        const email = normalizeEmail(req.body?.email || req.body?.username);
        const password = String(req.body?.password || '');
        const inviteCode = String(req.body?.inviteCode || '');
        const requiredInviteCode = String(process.env.TEACHER_INVITE_CODE || '').trim();

        if (!name || !email || !password) {
            return res.status(400).json({ error: 'name, email, and password are required' });
        }
        if (password.length < 8) {
            return res.status(400).json({ error: 'password must be at least 8 characters' });
        }
        if (requiredInviteCode && inviteCode !== requiredInviteCode) {
            return res.status(403).json({ error: 'Invalid invite code' });
        }

        const username = email;
        const [existingRows] = await pool.query(
            `
            SELECT id
            FROM teachers
            WHERE LOWER(username) = LOWER(?) OR LOWER(IFNULL(email, '')) = LOWER(?)
            LIMIT 1
            `,
            [username, email]
        );
        if (existingRows.length > 0) {
            return res.status(409).json({ error: 'Teacher account already exists' });
        }

        const [adminCountRows] = await pool.query(
            `
            SELECT COUNT(*) AS admin_count
            FROM teachers
            WHERE role = 'admin'
            `
        );
        const hasAdmin = Number(adminCountRows?.[0]?.admin_count || 0) > 0;
        const assignedRole = hasAdmin ? 'lecturer' : 'admin';

        const { salt, hash } = hashPassword(password);
        await pool.query(
            `
            INSERT INTO teachers (username, email, full_name, password_hash, password_salt, role)
            VALUES (?, ?, ?, ?, ?, ?)
            `,
            [username, email, name || null, hash, salt, assignedRole]
        );

        const token = createToken({ role: assignedRole, username });
        return res.status(201).json({
            message: 'Teacher registered successfully',
            token,
            teacher: { username, email, role: assignedRole, full_name: name || null }
        });
    } catch (err) {
        if (err.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ error: 'Teacher account already exists' });
        }
        console.error(err.message);
        return res.status(500).json({ error: 'Could not register teacher' });
    }
});

router.post('/login', async (req, res) => {
    const identifier = normalizeIdentifier(req.body?.identifier || req.body?.email || req.body?.username);
    const password = String(req.body?.password || '');

    if (!identifier || !password) {
        return res.status(400).json({ error: 'identifier and password are required' });
    }

    try {
        const [rows] = await pool.query(
            `
            SELECT username, email, role, full_name, password_hash, password_salt
            FROM teachers
            WHERE LOWER(username) = LOWER(?) OR LOWER(IFNULL(email, '')) = LOWER(?)
            LIMIT 1
            `,
            [identifier, identifier]
        );

        if (rows.length === 0) {
            return res.status(401).json({ error: 'Invalid username or password' });
        }

        const teacher = rows[0];
        const passwordOk = verifyPassword(password, teacher.password_salt, teacher.password_hash);
        if (!passwordOk) {
            return res.status(401).json({ error: 'Invalid username or password' });
        }

        // Migrate legacy PBKDF2 hashes to bcrypt on successful login.
        if (!isBcryptHash(teacher.password_hash)) {
            try {
                const { salt, hash } = hashPassword(password);
                await pool.query(
                    `
                    UPDATE teachers
                    SET password_hash = ?, password_salt = ?
                    WHERE username = ?
                    `,
                    [hash, salt, teacher.username]
                );
            } catch (migrationErr) {
                console.error('Could not migrate legacy password hash:', migrationErr.message);
            }
        }

        const token = createToken({ role: teacher.role || 'lecturer', username: teacher.username });
        return res.json({
            message: 'Login successful',
            token,
            teacher: {
                username: teacher.username,
                email: teacher.email || null,
                full_name: teacher.full_name || null,
                role: teacher.role || 'lecturer'
            }
        });
    } catch (err) {
        console.error(err.message);
        return res.status(500).json({ error: 'Could not log in' });
    }
});

router.post('/forgot-password', async (req, res) => {
    try {
        const identifier = normalizeIdentifier(req.body?.identifier || req.body?.email || req.body?.username);
        const newPassword = String(req.body?.newPassword || '');
        const resetKey = String(req.body?.resetKey || '');

        if (!identifier || !newPassword || !resetKey) {
            return res.status(400).json({ error: 'identifier, newPassword, and resetKey are required' });
        }
        if (newPassword.length < 8) {
            return res.status(400).json({ error: 'newPassword must be at least 8 characters' });
        }

        const keyHash = crypto.createHash('sha256').update(resetKey).digest('hex');
        const [resetRows] = await pool.query(
            `
            SELECT pr.id, pr.teacher_id
            FROM password_resets pr
            INNER JOIN teachers t ON t.id = pr.teacher_id
            WHERE LOWER(t.username) = LOWER(?) OR LOWER(IFNULL(t.email, '')) = LOWER(?)
              AND pr.token_hash = ?
              AND pr.used_at IS NULL
              AND pr.expires_at > NOW()
            ORDER BY pr.id DESC
            LIMIT 1
            `,
            [identifier, identifier, keyHash]
        );

        if (resetRows.length === 0) {
            return res.status(401).json({ error: 'Invalid or expired reset key' });
        }

        const { salt, hash } = hashPassword(newPassword);
        await pool.query(
            `
            UPDATE teachers
            SET password_hash = ?, password_salt = ?
            WHERE id = ?
            `,
            [hash, salt, resetRows[0].teacher_id]
        );

        await pool.query('UPDATE password_resets SET used_at = NOW() WHERE id = ?', [resetRows[0].id]);

        return res.json({ message: 'Password reset successful' });
    } catch (err) {
        console.error(err.message);
        return res.status(500).json({ error: 'Could not reset password' });
    }
});

router.get('/me', async (req, res) => {
    try {
        const authHeader = req.headers.authorization || '';
        const [scheme, token] = authHeader.split(' ');
        if (scheme !== 'Bearer' || !token) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const payload = verifyToken(token);
        if (!payload?.username) {
            return res.status(401).json({ error: 'Invalid or expired token' });
        }

        const [rows] = await pool.query(
            'SELECT username, email, role, full_name FROM teachers WHERE username = ? LIMIT 1',
            [payload.username]
        );
        if (rows.length === 0) {
            return res.status(401).json({ error: 'Teacher not found' });
        }

        return res.json({ teacher: rows[0] });
    } catch (err) {
        console.error(err.message);
        return res.status(500).json({ error: 'Could not fetch current user' });
    }
});

router.post('/admin/create-lecturer', async (req, res) => {
    try {
        const adminUser = await requireAdmin(req, res);
        if (!adminUser) {
            return;
        }

        const username = String(req.body?.username || '').trim();
        const password = String(req.body?.password || '');
        const fullName = String(req.body?.fullName || '').trim();

        if (!username || !password) {
            return res.status(400).json({ error: 'username and password are required' });
        }
        if (password.length < 8) {
            return res.status(400).json({ error: 'password must be at least 8 characters' });
        }

        const { salt, hash } = hashPassword(password);
        await pool.query(
            `
            INSERT INTO teachers (username, full_name, password_hash, password_salt, role, created_by_admin_id)
            VALUES (?, ?, ?, ?, 'lecturer', ?)
            `,
            [username, fullName || null, hash, salt, adminUser.id]
        );

        return res.status(201).json({ message: 'Lecturer created successfully', username });
    } catch (err) {
        if (err.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ error: 'username already exists' });
        }
        console.error(err.message);
        return res.status(500).json({ error: 'Could not create lecturer' });
    }
});

router.post('/admin/generate-reset-key', async (req, res) => {
    try {
        const adminUser = await requireAdmin(req, res);
        if (!adminUser) {
            return;
        }

        const username = String(req.body?.username || '').trim();
        const expiresHours = Number(req.body?.expiresHours || 24);
        const validHours = Number.isFinite(expiresHours) && expiresHours > 0 && expiresHours <= 168 ? expiresHours : 24;

        if (!username) {
            return res.status(400).json({ error: 'username is required' });
        }

        const [teacherRows] = await pool.query(
            'SELECT id, username, role FROM teachers WHERE username = ? LIMIT 1',
            [username]
        );
        if (teacherRows.length === 0) {
            return res.status(404).json({ error: 'Lecturer not found' });
        }
        if (teacherRows[0].role !== 'lecturer') {
            return res.status(400).json({ error: 'Reset keys are for lecturer accounts only' });
        }

        const resetKeyPlain = crypto.randomBytes(24).toString('base64url');
        const tokenHash = crypto.createHash('sha256').update(resetKeyPlain).digest('hex');

        await pool.query(
            `
            INSERT INTO password_resets (teacher_id, token_hash, expires_at, created_by_admin_id)
            VALUES (?, ?, DATE_ADD(NOW(), INTERVAL ? HOUR), ?)
            `,
            [teacherRows[0].id, tokenHash, validHours, adminUser.id]
        );

        return res.json({
            message: 'Reset key generated',
            username: teacherRows[0].username,
            resetKey: resetKeyPlain,
            expiresInHours: validHours
        });
    } catch (err) {
        console.error(err.message);
        return res.status(500).json({ error: 'Could not generate reset key' });
    }
});

router.get('/admin/teachers', async (req, res) => {
    try {
        const adminUser = await requireAdmin(req, res);
        if (!adminUser) {
            return;
        }

        const [rows] = await pool.query(
            `
            SELECT id, username, email, full_name, role, created_at, created_by_admin_id
            FROM teachers
            ORDER BY CASE role WHEN 'admin' THEN 0 ELSE 1 END, created_at ASC, id ASC
            `
        );

        return res.json({ teachers: rows });
    } catch (err) {
        console.error(err.message);
        return res.status(500).json({ error: 'Could not fetch teachers' });
    }
});

router.put('/admin/teachers/:id/role', async (req, res) => {
    try {
        const adminUser = await requireAdmin(req, res);
        if (!adminUser) {
            return;
        }

        const teacherId = Number(req.params.id);
        const nextRole = String(req.body?.role || '').trim().toLowerCase();
        if (!Number.isInteger(teacherId) || teacherId <= 0) {
            return res.status(400).json({ error: 'Valid teacher id is required' });
        }
        if (!['admin', 'lecturer'].includes(nextRole)) {
            return res.status(400).json({ error: 'role must be admin or lecturer' });
        }

        const [targetRows] = await pool.query(
            `
            SELECT id, username, role
            FROM teachers
            WHERE id = ?
            LIMIT 1
            `,
            [teacherId]
        );
        if (targetRows.length === 0) {
            return res.status(404).json({ error: 'Teacher not found' });
        }

        const target = targetRows[0];
        if (target.role === 'admin' && nextRole === 'lecturer') {
            const [adminCountRows] = await pool.query(
                `
                SELECT COUNT(*) AS admin_count
                FROM teachers
                WHERE role = 'admin'
                `
            );
            const adminCount = Number(adminCountRows?.[0]?.admin_count || 0);
            if (adminCount <= 1) {
                return res.status(400).json({ error: 'At least one admin account is required' });
            }
        }

        await pool.query(
            `
            UPDATE teachers
            SET role = ?
            WHERE id = ?
            `,
            [nextRole, teacherId]
        );

        const [updatedRows] = await pool.query(
            `
            SELECT id, username, email, full_name, role, created_at, created_by_admin_id
            FROM teachers
            WHERE id = ?
            LIMIT 1
            `,
            [teacherId]
        );

        return res.json({
            message: `Role updated for ${target.username}`,
            teacher: updatedRows[0]
        });
    } catch (err) {
        console.error(err.message);
        return res.status(500).json({ error: 'Could not update teacher role' });
    }
});

module.exports = router;
