const { poolPromise, sql } = require('./db');

async function run() {
    try {
        const pool = await poolPromise;
        const res1 = await pool.request()
            .query("UPDATE Friendships SET Status = 'accepted' WHERE RequesterId = 2 AND AddresseeId = 3");
        console.log('Update Request from 2 to 3:', res1.rowsAffected);
        
    } catch (e) {
        console.error(e);
    } finally {
        process.exit(0);
    }
}
run();
