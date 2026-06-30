const sql = require('mssql/msnodesqlv8');

const config = {
    server: '(localdb)\\MSSQLLocalDB',
    database: 'VibeChatDB',
    driver: 'msnodesqlv8',
    options: {
        trustedConnection: true,
        driver: 'ODBC Driver 17 for SQL Server'
    }
};

new sql.ConnectionPool(config).connect().then(pool => {
    console.log('Connected options.driver');
    pool.close();
}).catch(err => {
    console.log('Error options.driver: ', err.message);
    
    // Fallback to connectionString
    const config2 = {
        connectionString: 'Driver={ODBC Driver 17 for SQL Server};Server=(localdb)\\MSSQLLocalDB;Database=VibeChatDB;Trusted_Connection=yes;'
    };
    new sql.ConnectionPool(config2).connect().then(pool => {
        console.log('Connected connectionString');
        pool.close();
    }).catch(err2 => console.log('Error connectionString: ', err2.message));
});
