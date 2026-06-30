const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
require('dotenv').config();
const { poolPromise, sql } = require('./db');

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "http://localhost:3000",
        methods: ["GET", "POST"]
    }
});

// Setup DB schema on start
async function initDb() {
    try {
        const pool = await poolPromise;
        // Create Users table
        await pool.request().query(`
            IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='Users' and xtype='U')
            CREATE TABLE Users (
                Id INT IDENTITY(1,1) PRIMARY KEY,
                Username NVARCHAR(100) UNIQUE NOT NULL,
                CreatedAt DATETIME DEFAULT GETDATE()
            )
        `);
        // Create Messages table
        await pool.request().query(`
            IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='Messages' and xtype='U')
            CREATE TABLE Messages (
                Id INT IDENTITY(1,1) PRIMARY KEY,
                SenderId INT NOT NULL,
                Content NVARCHAR(MAX) NOT NULL,
                CreatedAt DATETIME DEFAULT GETDATE(),
                FOREIGN KEY (SenderId) REFERENCES Users(Id)
            )
        `);
        console.log('Database tables initialized');
    } catch (err) {
        console.error('Failed to initialize db:', err);
    }
}
initDb();

// Routes
app.post('/api/login', async (req, res) => {
    const { username } = req.body;
    if (!username) return res.status(400).json({ error: 'Username required' });
    
    try {
        const pool = await poolPromise;
        let result = await pool.request()
            .input('username', sql.NVarChar, username)
            .query('SELECT * FROM Users WHERE Username = @username');
        
        let user = result.recordset[0];
        
        if (!user) {
            // Register if not found
            const insertResult = await pool.request()
                .input('username', sql.NVarChar, username)
                .query('INSERT INTO Users (Username) OUTPUT INSERTED.* VALUES (@username)');
            user = insertResult.recordset[0];
        }
        
        res.json({ user });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

app.get('/api/messages', async (req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request().query(`
            SELECT m.Id, m.Content, m.CreatedAt, u.Username, m.SenderId
            FROM Messages m
            JOIN Users u ON m.SenderId = u.Id
            ORDER BY m.CreatedAt ASC
        `);
        res.json(result.recordset);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

// Socket.io
io.on('connection', (socket) => {
    console.log('User connected:', socket.id);
    
    socket.on('join', (user) => {
        socket.user = user;
        console.log(`${user.Username} joined`);
    });

    socket.on('sendMessage', async (data) => {
        const { senderId, content, username } = data;
        
        try {
            const pool = await poolPromise;
            const result = await pool.request()
                .input('senderId', sql.Int, senderId)
                .input('content', sql.NVarChar, content)
                .query('INSERT INTO Messages (SenderId, Content) OUTPUT INSERTED.Id, INSERTED.CreatedAt VALUES (@senderId, @content)');
            
            const newMessage = {
                Id: result.recordset[0].Id,
                SenderId: senderId,
                Content: content,
                CreatedAt: result.recordset[0].CreatedAt,
                Username: username
            };
            
            io.emit('receiveMessage', newMessage);
        } catch (err) {
            console.error('Error saving message:', err);
        }
    });

    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
    });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
