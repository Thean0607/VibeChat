const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const bcrypt = require('bcryptjs');
require('dotenv').config();
const { poolPromise, sql } = require('./db');

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: ["http://localhost:3000", "http://localhost:3001", "http://localhost:3002"],
        methods: ["GET", "POST"]
    }
});

// Setup DB schema on start
async function initDb() {
    try {
        const pool = await poolPromise;
        // Create or Update Users table
        await pool.request().query(`
            IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='Users' and xtype='U')
            BEGIN
                CREATE TABLE Users (
                    Id INT IDENTITY(1,1) PRIMARY KEY,
                    Username NVARCHAR(100) UNIQUE NOT NULL,
                    Password NVARCHAR(255) NOT NULL,
                    FullName NVARCHAR(255) NULL,
                    DateOfBirth DATE NULL,
                    Email NVARCHAR(255) NULL,
                    FacebookLink NVARCHAR(255) NULL,
                    CreatedAt DATETIME DEFAULT GETDATE()
                )
            END
            ELSE
            BEGIN
                -- Add new columns if missing
                IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[Users]') AND name = 'Password')
                    ALTER TABLE Users ADD Password NVARCHAR(255) NOT NULL DEFAULT '';
                IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[Users]') AND name = 'FullName')
                    ALTER TABLE Users ADD FullName NVARCHAR(255) NULL;
                IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[Users]') AND name = 'DateOfBirth')
                    ALTER TABLE Users ADD DateOfBirth DATE NULL;
                IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[Users]') AND name = 'Email')
                    ALTER TABLE Users ADD Email NVARCHAR(255) NULL;
                IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[Users]') AND name = 'FacebookLink')
                    ALTER TABLE Users ADD FacebookLink NVARCHAR(255) NULL;
            END
        `);
        // Create Messages table
        await pool.request().query(`
            IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='Messages' and xtype='U')
            BEGIN
                CREATE TABLE Messages (
                    Id INT IDENTITY(1,1) PRIMARY KEY,
                    SenderId INT NOT NULL,
                    ReceiverId INT NOT NULL,
                    Content NVARCHAR(MAX) NOT NULL,
                    CreatedAt DATETIME DEFAULT GETDATE(),
                    FOREIGN KEY (SenderId) REFERENCES Users(Id),
                    FOREIGN KEY (ReceiverId) REFERENCES Users(Id)
                )
            END
            ELSE
            BEGIN
                IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[Messages]') AND name = 'ReceiverId')
                BEGIN
                    ALTER TABLE Messages ADD ReceiverId INT NULL;
                    ALTER TABLE Messages ADD CONSTRAINT FK_Messages_Receiver FOREIGN KEY (ReceiverId) REFERENCES Users(Id);
                END
            END
        `);
        
        // Create Friendships table
        await pool.request().query(`
            IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='Friendships' and xtype='U')
            BEGIN
                CREATE TABLE Friendships (
                    Id INT IDENTITY(1,1) PRIMARY KEY,
                    RequesterId INT NOT NULL,
                    AddresseeId INT NOT NULL,
                    Status NVARCHAR(50) DEFAULT 'pending',
                    CreatedAt DATETIME DEFAULT GETDATE(),
                    CONSTRAINT FK_Friendships_Requester FOREIGN KEY (RequesterId) REFERENCES Users(Id) ON DELETE CASCADE,
                    CONSTRAINT FK_Friendships_Addressee FOREIGN KEY (AddresseeId) REFERENCES Users(Id) ON DELETE NO ACTION
                )
            END
        `);
        
        console.log('Database tables initialized/updated');
    } catch (err) {
        console.error('Failed to initialize db:', err);
    }
}
initDb();

// Routes
app.post('/api/register', async (req, res) => {
    const { username, password, fullName, dateOfBirth, email, facebookLink } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Username and password required' });
    
    try {
        const pool = await poolPromise;
        // Check if user exists
        let check = await pool.request()
            .input('username', sql.NVarChar, username)
            .query('SELECT * FROM Users WHERE Username = @username');
            
        if (check.recordset.length > 0) {
            return res.status(400).json({ error: 'Username already exists' });
        }
        
        // Hash password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);
        
        const insertResult = await pool.request()
            .input('username', sql.NVarChar, username)
            .input('password', sql.NVarChar, hashedPassword)
            .input('fullName', sql.NVarChar, fullName || null)
            .input('dateOfBirth', sql.Date, dateOfBirth || null)
            .input('email', sql.NVarChar, email || null)
            .input('facebookLink', sql.NVarChar, facebookLink || null)
            .query(`
                INSERT INTO Users (Username, Password, FullName, DateOfBirth, Email, FacebookLink) 
                OUTPUT INSERTED.Id, INSERTED.Username, INSERTED.FullName, INSERTED.DateOfBirth, INSERTED.Email, INSERTED.FacebookLink, INSERTED.CreatedAt 
                VALUES (@username, @password, @fullName, @dateOfBirth, @email, @facebookLink)
            `);
            
        res.json({ user: insertResult.recordset[0] });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Username and password required' });
    
    try {
        const pool = await poolPromise;
        let result = await pool.request()
            .input('username', sql.NVarChar, username)
            .query('SELECT * FROM Users WHERE Username = @username OR Email = @username');
        
        let user = result.recordset[0];
        
        if (!user) {
            return res.status(400).json({ error: 'Invalid username or password' });
        }
        
        // Compare password (allow empty pass for old users if necessary, but assume all need pass now)
        if (user.Password) {
            const isMatch = await bcrypt.compare(password, user.Password);
            if (!isMatch) {
                return res.status(400).json({ error: 'Invalid username or password' });
            }
        }
        
        // Remove password before sending to client
        delete user.Password;
        res.json({ user });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

app.get('/api/users/:currentUserId', async (req, res) => {
    try {
        const { currentUserId } = req.params;
        const pool = await poolPromise;
        const result = await pool.request()
            .input('currentUserId', sql.Int, currentUserId)
            .query('SELECT Id, Username, FullName FROM Users WHERE Id != @currentUserId');
        res.json(result.recordset);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

app.get('/api/messages', async (req, res) => {
    const { user1, user2 } = req.query;
    try {
        const pool = await poolPromise;
        let query = `
            SELECT m.Id, m.Content, m.CreatedAt, u.Username, u.FullName, m.SenderId, m.ReceiverId
            FROM Messages m
            JOIN Users u ON m.SenderId = u.Id
        `;
        const request = pool.request();
        
        if (user1 && user2) {
            query += ` WHERE (m.SenderId = @user1 AND m.ReceiverId = @user2) OR (m.SenderId = @user2 AND m.ReceiverId = @user1) `;
            request.input('user1', sql.Int, user1);
            request.input('user2', sql.Int, user2);
        }
        
        query += ` ORDER BY m.CreatedAt ASC `;
        
        const result = await request.query(query);
        res.json(result.recordset);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

// Friendship Routes
app.get('/api/users/search', async (req, res) => {
    const { q, currentUserId } = req.query;
    try {
        const pool = await poolPromise;
        const result = await pool.request()
            .input('q', sql.NVarChar, `%${q}%`)
            .input('currentUserId', sql.Int, currentUserId)
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
        res.json(result.recordset);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

app.post('/api/friends/request', async (req, res) => {
    const { requesterId, addresseeId } = req.body;
    try {
        const pool = await poolPromise;
        await pool.request()
            .input('reqId', sql.Int, requesterId)
            .input('addId', sql.Int, addresseeId)
            .query(`
                IF NOT EXISTS (SELECT 1 FROM Friendships WHERE (RequesterId=@reqId AND AddresseeId=@addId) OR (RequesterId=@addId AND AddresseeId=@reqId))
                BEGIN
                    INSERT INTO Friendships (RequesterId, AddresseeId, Status) VALUES (@reqId, @addId, 'pending')
                END
            `);
        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

app.post('/api/friends/accept', async (req, res) => {
    const { requesterId, addresseeId } = req.body;
    try {
        const pool = await poolPromise;
        await pool.request()
            .input('reqId', sql.Int, requesterId)
            .input('addId', sql.Int, addresseeId)
            .query(`
                UPDATE Friendships 
                SET Status = 'accepted' 
                WHERE RequesterId = @reqId AND AddresseeId = @addId
            `);
        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

app.get('/api/friends/:userId', async (req, res) => {
    const { userId } = req.params;
    try {
        const pool = await poolPromise;
        const result = await pool.request()
            .input('userId', sql.Int, userId)
            .query(`
                SELECT u.Id, u.Username, u.FullName, f.Status, f.RequesterId, f.AddresseeId 
                FROM Friendships f
                JOIN Users u ON (u.Id = f.RequesterId OR u.Id = f.AddresseeId) AND u.Id != @userId
                WHERE (f.RequesterId = @userId OR f.AddresseeId = @userId)
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
        const { senderId, receiverId, content, username } = data;
        
        try {
            const pool = await poolPromise;
            const result = await pool.request()
                .input('senderId', sql.Int, senderId)
                .input('receiverId', sql.Int, receiverId)
                .input('content', sql.NVarChar, content)
                .query('INSERT INTO Messages (SenderId, ReceiverId, Content) OUTPUT INSERTED.Id, INSERTED.CreatedAt VALUES (@senderId, @receiverId, @content)');
            
            const newMessage = {
                Id: result.recordset[0].Id,
                SenderId: senderId,
                ReceiverId: receiverId,
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
