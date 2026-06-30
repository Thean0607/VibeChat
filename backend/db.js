// Sử dụng msnodesqlv8 để hỗ trợ kết nối (localdb) bằng Windows Authentication
const sql = require('mssql/msnodesqlv8');

const config = {
    // Sử dụng connectionString để ép msnodesqlv8 dùng đúng Driver hiện có trên máy (ODBC Driver 17)
    connectionString: 'Driver={ODBC Driver 17 for SQL Server};Server=(localdb)\\MSSQLLocalDB;Database=VibeChatDB;Trusted_Connection=yes;'
};

const poolPromise = new sql.ConnectionPool(config)
    .connect()
    .then(pool => {
        console.log('Connected to SQL Server (LocalDB)');
        return pool;
    })
    .catch(err => {
        console.log('Database Connection Failed! Lỗi cấu hình: ', err);
        throw err;
    });

module.exports = {
    sql, poolPromise
};
