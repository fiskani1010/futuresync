const crypto = require('crypto');
const bcrypt = require('bcrypt');

const LEGACY_PBKDF2_ITERATIONS = 120000;
const LEGACY_PBKDF2_KEYLEN = 64;
const LEGACY_PBKDF2_DIGEST = 'sha512';
const DEFAULT_BCRYPT_ROUNDS = 12;

function getBcryptRounds() {
    const parsed = Number(process.env.BCRYPT_ROUNDS || DEFAULT_BCRYPT_ROUNDS);
    if (!Number.isInteger(parsed) || parsed < 8 || parsed > 15) {
        return DEFAULT_BCRYPT_ROUNDS;
    }
    return parsed;
}

function isBcryptHash(value) {
    return /^\$2[aby]\$\d{2}\$/.test(String(value || ''));
}

function hashLegacyPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
    const hash = crypto
        .pbkdf2Sync(password, salt, LEGACY_PBKDF2_ITERATIONS, LEGACY_PBKDF2_KEYLEN, LEGACY_PBKDF2_DIGEST)
        .toString('hex');
    return { salt, hash };
}

function hashPassword(password) {
    const rounds = getBcryptRounds();
    const hash = bcrypt.hashSync(password, rounds);
    return { salt: '', hash };
}

function verifyPassword(password, salt, expectedHash) {
    if (!expectedHash) {
        return false;
    }

    if (isBcryptHash(expectedHash)) {
        return bcrypt.compareSync(password, expectedHash);
    }

    if (!salt) {
        return false;
    }

    const { hash } = hashLegacyPassword(password, salt);
    const left = Buffer.from(hash, 'hex');
    const right = Buffer.from(expectedHash, 'hex');
    if (left.length !== right.length) {
        return false;
    }
    return crypto.timingSafeEqual(left, right);
}

module.exports = {
    hashPassword,
    verifyPassword,
    isBcryptHash
};
