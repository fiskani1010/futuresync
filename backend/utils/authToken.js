const jwt = require('jsonwebtoken');

const isProduction = process.env.NODE_ENV === 'production';
const configuredSecret = process.env.JWT_SECRET;

if (isProduction && !configuredSecret) {
    throw new Error('JWT_SECRET is required in production');
}

if (!isProduction && !configuredSecret) {
    console.warn('JWT_SECRET not set. Using insecure development default.');
}

const TOKEN_SECRET = configuredSecret || 'please-change-this-secret';
const TOKEN_ISSUER = process.env.JWT_ISSUER || 'futuresync';
const TOKEN_AUDIENCE = process.env.JWT_AUDIENCE || 'futuresync-users';

function createToken(payload, expiresIn = '12h') {
    return jwt.sign(payload, TOKEN_SECRET, {
        algorithm: 'HS256',
        expiresIn,
        issuer: TOKEN_ISSUER,
        audience: TOKEN_AUDIENCE
    });
}

function verifyToken(token) {
    try {
        return jwt.verify(token, TOKEN_SECRET, {
            algorithms: ['HS256'],
            issuer: TOKEN_ISSUER,
            audience: TOKEN_AUDIENCE
        });
    } catch {
        return null;
    }
}

module.exports = {
    createToken,
    verifyToken
};
