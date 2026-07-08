const { poolPromise } = require('./db');

async function run() {
    try {
        const pool = await poolPromise;
        const result = await pool.request().query("SELECT Id, Username, FullName FROM Users");
        console.log('USERS:', result.recordset);
    } catch (e) {
        console.error(e);
    } finally {
        process.exit(0);
    }
}
run();
