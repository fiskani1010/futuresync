const { hashPassword } = require('../utils/password');

function printUsage() {
    console.log('Usage: node scripts/hash-password.js "<plain-password>"');
    console.log('Example: node scripts/hash-password.js "DAMN@2040"');
}

function main() {
    const plainPassword = String(process.argv[2] || '').trim();
    if (!plainPassword) {
        printUsage();
        process.exit(1);
    }

    const { salt, hash } = hashPassword(plainPassword);

    console.log('Password hash generated successfully.');
    console.log(`password_hash: ${hash}`);
    console.log(`password_salt: ${salt}`);
    console.log('');
    console.log('SQL example:');
    console.log(
        `INSERT INTO teachers (username, full_name, password_hash, password_salt, role) VALUES ('admin1', 'Admin User', '${hash}', '${salt}', 'admin');`
    );
}

main();
