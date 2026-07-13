const { poolPromise, sql } = require('./db');

async function migrate() {
    try {
        const pool = await poolPromise;
        console.log('Connected to DB. Checking Messages table...');
        
        try {
            await pool.request().query(`
                ALTER TABLE Messages
                ADD ImageUrl NVARCHAR(MAX) NULL
            `);
            console.log('Successfully added ImageUrl column to Messages table.');
        } catch (err) {
            if (err.message.includes('already exists') || err.number === 2705 || err.message.includes('Column names in each table must be unique')) {
                console.log('ImageUrl column already exists.');
            } else {
                console.error('Error altering table:', err);
            }
        }
    } catch (err) {
        console.error('Failed to connect to DB:', err);
    } finally {
        process.exit(0);
    }
}

migrate();
