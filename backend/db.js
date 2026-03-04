const mysql = require('mysql2/promise');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

function parseBool(value, fallback) {
    if (typeof value !== 'string') {
        return fallback;
    }
    return ['1', 'true', 'yes', 'on'].includes(value.trim().toLowerCase());
}

const requiredEnv = ['DB_HOST', 'DB_USER', 'DB_PASSWORD', 'DB_NAME'];
const missingEnv = requiredEnv.filter((key) => !process.env[key]);
if (missingEnv.length > 0) {
    throw new Error(`Missing required database environment variables: ${missingEnv.join(', ')}`);
}

const useSsl = parseBool(process.env.DB_SSL, false);
const rejectUnauthorized = parseBool(process.env.DB_SSL_REJECT_UNAUTHORIZED, true);
const pool = mysql.createPool({

    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    ssl: useSsl ? { rejectUnauthorized } : undefined,
    waitForConnections: true,
    connectionLimit: 20,
    queueLimit: 0



});



module.exports = pool;
