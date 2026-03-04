const fs = require('fs');
const mysql = require('mysql2/promise');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

function parseBool(value, fallback) {
    if (typeof value !== 'string') {
        return fallback;
    }
    return ['1', 'true', 'yes', 'on'].includes(value.trim().toLowerCase());
}

const dbHost = String(process.env.DB_HOST || process.env.AIVEN_MYSQL_HOST || '').trim();
const dbPort = Number(process.env.DB_PORT || process.env.AIVEN_MYSQL_PORT || 3306);
const dbUser = String(process.env.DB_USER || process.env.AIVEN_MYSQL_USER || '').trim();
const dbPassword = String(process.env.DB_PASSWORD || process.env.AIVEN_MYSQL_PASSWORD || '');
const dbName = String(process.env.DB_NAME || process.env.AIVEN_MYSQL_DATABASE || '').trim();

const missingEnv = [];
if (!dbHost) missingEnv.push('DB_HOST');
if (!dbUser) missingEnv.push('DB_USER');
if (!dbPassword) missingEnv.push('DB_PASSWORD');
if (!dbName) missingEnv.push('DB_NAME');
if (missingEnv.length > 0) {
    throw new Error(`Missing required database environment variables: ${missingEnv.join(', ')}`);
}

const host = dbHost;
const defaultUseSsl = host.includes('aivencloud.com');
const useSsl = parseBool(process.env.DB_SSL, defaultUseSsl);
const inlineCa = String(process.env.DB_CA_CERT || process.env.AIVEN_CA_CERT || '').trim();
const caPath = String(process.env.DB_CA_CERT_PATH || '').trim();

let caCertificate = '';
if (inlineCa) {
    caCertificate = inlineCa.replace(/\\n/g, '\n');
} else if (caPath) {
    const resolvedPath = path.isAbsolute(caPath) ? caPath : path.join(__dirname, caPath);
    caCertificate = fs.readFileSync(resolvedPath, 'utf8');
}

const defaultRejectUnauthorized = useSsl ? Boolean(caCertificate) : true;
const rejectUnauthorized = parseBool(process.env.DB_SSL_REJECT_UNAUTHORIZED, defaultRejectUnauthorized);
const sslConfig = useSsl
    ? {
        rejectUnauthorized,
        ...(caCertificate ? { ca: caCertificate } : {})
    }
    : undefined;

const pool = mysql.createPool({

    host,
    port: dbPort,
    user: dbUser,
    password: dbPassword,
    database: dbName,
    ssl: sslConfig,
    waitForConnections: true,
    connectionLimit: 20,
    queueLimit: 0



});



module.exports = pool;
