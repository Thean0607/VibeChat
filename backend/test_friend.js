const { poolPromise, sql } = require('./db');

async function run() {
    try {
        const pool = await poolPromise;
        const res1 = await pool.request()
            .input('reqId', sql.Int, 2)
            .input('addId', sql.Int, 3)
            .query(`
                IF NOT EXISTS (SELECT 1 FROM Friendships WHERE (RequesterId=@reqId AND AddresseeId=@addId) OR (RequesterId=@addId AND AddresseeId=@reqId))
                BEGIN
                    INSERT INTO Friendships (RequesterId, AddresseeId, Status) VALUES (@reqId, @addId, 'pending')
                END
            `);
        console.log('Insert Request from 2 to 3:', res1.rowsAffected);
        
        const res2 = await pool.request()
            .query("SELECT * FROM Friendships");
        console.log('Friendships table:', res2.recordset);
    } catch (e) {
        console.error(e);
    } finally {
        process.exit(0);
    }
}
run();
