const { poolPromise, sql } = require('./db');

async function run() {
    try {
        const pool = await poolPromise;
        const result = await pool.request()
            .input('q', sql.NVarChar, `%test%`)
            .input('currentUserId', sql.Int, 3)
            .query(`
                SELECT u.Id, u.Username, u.FullName, 
                       f.Status, f.RequesterId, f.AddresseeId 
                FROM Users u
                LEFT JOIN Friendships f 
                  ON (u.Id = f.RequesterId AND f.AddresseeId = @currentUserId) 
                  OR (u.Id = f.AddresseeId AND f.RequesterId = @currentUserId)
                WHERE u.Id != @currentUserId 
                  AND (u.Username LIKE @q OR u.FullName LIKE @q)
            `);
        console.log('RESULT:', result.recordset);
    } catch (e) {
        console.error('ERROR:', e);
    } finally {
        process.exit(0);
    }
}
run();
