const { poolPromise } = require('./db');

async function run() {
    try {
        const pool = await poolPromise;
        await pool.request().query("UPDATE Users SET FullName = 'Yukki' WHERE Username = 'test'");
        console.log('--- UPDATED ---');
    } catch (e) {
        console.error(e);
    } finally {
        process.exit(0);
    }
}
run();
