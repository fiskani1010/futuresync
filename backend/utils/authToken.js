const crypto = require('crypto');

const isProduction = process.env.NODE_ENV === 'production';
const configuredSecret = process.env.JWT_SECRET;

if (isProduction && !configuredSecret) {
    throw new Error('JWT_SECRET is required in production');
}

if (!isProduction && !configuredSecret) {
    console.warn('JWT_SECRET not set. Using insecure development default.');
}

const TOKEN_SECRET = configuredSecret || 'please-change-this-secret';

function toBase64Url(value) {
    return Buffer.from(value)
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/g, '');
}

function fromBase64Url(value) {
    const padded = value.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((value.length + 3) % 4);
    return Buffer.from(padded, 'base64').toString('utf8');
}

function sign(payloadPart) {
    return crypto.createHmac('sha256', TOKEN_SECRET).update(payloadPart).digest('base64url');
}

function safeEqual(a, b) {
    const left = Buffer.from(a);
    const right = Buffer.from(b);
    if (left.length !== right.length) {
        return false;
    }
    return crypto.timingSafeEqual(left, right);
}

function createToken(payload, expiresInSeconds = 60 * 60 * 12) {
    const exp = Math.floor(Date.now() / 1000) + expiresInSeconds;
    const payloadPart = toBase64Url(JSON.stringify({ ...payload, exp }));
    const signature = sign(payloadPart);
    return `${payloadPart}.${signature}`;
}

function verifyToken(token) {
    if (!token || typeof token !== 'string') {
        return null;
    }

    const parts = token.split('.');
    if (parts.length !== 2) {
        return null;
    }

    const [payloadPart, signature] = parts;
    const expectedSignature = sign(payloadPart);
    if (!safeEqual(signature, expectedSignature)) {
        return null;
    }

    try {
        const payload = JSON.parse(fromBase64Url(payloadPart));
        if (!payload?.exp || payload.exp < Math.floor(Date.now() / 1000)) {
            return null;
        }
        return payload;
    } catch {
        return null;
    }
}

module.exports = {
    createToken,
    verifyToken
};
