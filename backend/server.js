const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
require('dotenv').config();
const { poolPromise, sql } = require('./db');

const app = express();
app.use(cors());
app.use(express.json());

// Setup static uploads folder
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir);
}
app.use('/uploads', express.static(uploadsDir));

// Multer config
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadsDir),
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});
const upload = multer({ storage });

const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
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
                    Email NVARCHAR(255) UNIQUE NULL,
                    AvatarUrl NVARCHAR(500) NULL,
                    Bio NVARCHAR(1000) NULL,
                    Status NVARCHAR(50) DEFAULT 'offline',
                    LastLogin DATETIME NULL,
                    IsActive BIT DEFAULT 1,
                    CreatedAt DATETIME DEFAULT GETDATE(),
                    UpdatedAt DATETIME DEFAULT GETDATE()
                );
                CREATE NONCLUSTERED INDEX IX_Users_Username ON Users(Username);
                CREATE NONCLUSTERED INDEX IX_Users_Email ON Users(Email);
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
                IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[Users]') AND name = 'AvatarUrl')
                    ALTER TABLE Users ADD AvatarUrl NVARCHAR(500) NULL;
                IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[Users]') AND name = 'Bio')
                    ALTER TABLE Users ADD Bio NVARCHAR(1000) NULL;
                IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[Users]') AND name = 'Status')
                    ALTER TABLE Users ADD Status NVARCHAR(50) DEFAULT 'offline';
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
                    AttachmentUrl NVARCHAR(500) NULL,
                    IsRead BIT DEFAULT 0,
                    ReadAt DATETIME NULL,
                    IsDeleted BIT DEFAULT 0,
                    CreatedAt DATETIME DEFAULT GETDATE(),
                    UpdatedAt DATETIME DEFAULT GETDATE(),
                    CONSTRAINT FK_Messages_Sender FOREIGN KEY (SenderId) REFERENCES Users(Id) ON DELETE CASCADE,
                    CONSTRAINT FK_Messages_Receiver FOREIGN KEY (ReceiverId) REFERENCES Users(Id) ON DELETE NO ACTION
                );
                CREATE NONCLUSTERED INDEX IX_Messages_SenderReceiver ON Messages(SenderId, ReceiverId);
                CREATE NONCLUSTERED INDEX IX_Messages_CreatedAt ON Messages(CreatedAt);
            END
            ELSE
            BEGIN
                IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[Messages]') AND name = 'ReceiverId')
                BEGIN
                    ALTER TABLE Messages ADD ReceiverId INT NULL;
                    ALTER TABLE Messages ADD CONSTRAINT FK_Messages_Receiver FOREIGN KEY (ReceiverId) REFERENCES Users(Id);
                END
                IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[Messages]') AND name = 'AttachmentUrl')
                    ALTER TABLE Messages ADD AttachmentUrl NVARCHAR(500) NULL;
                IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[Messages]') AND name = 'IsRead')
                    ALTER TABLE Messages ADD IsRead BIT DEFAULT 0;
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
                    UpdatedAt DATETIME DEFAULT GETDATE(),
                    CONSTRAINT FK_Friendships_Requester FOREIGN KEY (RequesterId) REFERENCES Users(Id) ON DELETE CASCADE,
                    CONSTRAINT FK_Friendships_Addressee FOREIGN KEY (AddresseeId) REFERENCES Users(Id) ON DELETE NO ACTION,
                    CONSTRAINT UQ_Friendships_Requester_Addressee UNIQUE (RequesterId, AddresseeId),
                    CONSTRAINT CHK_Friendships_Status CHECK (Status IN ('pending', 'accepted', 'blocked', 'declined'))
                );
                CREATE NONCLUSTERED INDEX IX_Friendships_Requester ON Friendships(RequesterId);
                CREATE NONCLUSTERED INDEX IX_Friendships_Addressee ON Friendships(AddresseeId);
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
    const { username, password, fullName, dateOfBirth, email } = req.body;
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
            .query(`
                INSERT INTO Users (Username, Password, FullName, DateOfBirth, Email) 
                OUTPUT INSERTED.Id, INSERTED.Username, INSERTED.FullName, INSERTED.DateOfBirth, INSERTED.Email, INSERTED.CreatedAt 
                VALUES (@username, @password, @fullName, @dateOfBirth, @email)
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

app.get('/api/users/list/:currentUserId', async (req, res) => {
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
            SELECT m.Id, m.Content, m.CreatedAt, u.Username, u.FullName, m.SenderId, m.ReceiverId, m.IsRead, m.AttachmentUrl
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

app.post('/api/upload', upload.single('file'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
    }
    const fileUrl = `http://${req.hostname}:5000/uploads/${req.file.filename}`;
    res.json({ url: fileUrl });
});

// Friendship Routes
app.get('/api/users/search', async (req, res) => {
    const { q } = req.query;
    const currentUserId = parseInt(req.query.currentUserId, 10);
    console.log(`[SEARCH] q=${q}, currentUserId=${currentUserId}`);
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
        console.log(`[SEARCH] Found ${result.recordset.length} users`);
        res.json(result.recordset);
    } catch (err) {
        console.error('[SEARCH ERROR]', err);
        res.status(500).json({ error: 'Server error' });
    }
});

app.post('/api/friends/request', async (req, res) => {
    const { requesterId, addresseeId } = req.body;
    console.log(`[FRIEND_REQ] requester=${requesterId} addressee=${addresseeId}`);
    try {
        const pool = await poolPromise;
        const check = await pool.request()
            .input('reqId', sql.Int, requesterId)
            .input('addId', sql.Int, addresseeId)
            .query(`
                SELECT Status, RequesterId, AddresseeId FROM Friendships 
                WHERE (RequesterId=@reqId AND AddresseeId=@addId) 
                   OR (RequesterId=@addId AND AddresseeId=@reqId)
            `);
            
        if (check.recordset.length > 0) {
            const existing = check.recordset[0];
            if (existing.Status === 'pending' && existing.RequesterId === addresseeId && existing.AddresseeId === requesterId) {
                // Auto accept
                await pool.request()
                    .input('reqId', sql.Int, requesterId)
                    .input('addId', sql.Int, addresseeId)
                    .query(`
                        UPDATE Friendships 
                        SET Status = 'accepted' 
                        WHERE RequesterId=@addId AND AddresseeId=@reqId
                    `);
                io.emit('friendUpdate');
                return res.json({ success: true, autoAccepted: true });
            } else {
                return res.json({ success: true, alreadyExists: true });
            }
        } else {
            await pool.request()
                .input('reqId', sql.Int, requesterId)
                .input('addId', sql.Int, addresseeId)
                .query(`
                    INSERT INTO Friendships (RequesterId, AddresseeId, Status) VALUES (@reqId, @addId, 'pending')
                `);
            io.emit('friendUpdate');
            res.json({ success: true });
        }
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

app.post('/api/friends/accept', async (req, res) => {
    const { requesterId, addresseeId } = req.body;
    console.log(`[FRIEND_ACCEPT] requester=${requesterId} addressee=${addresseeId}`);
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
        io.emit('friendUpdate');
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
                SELECT u.Id, u.Username, u.FullName, f.Status, f.RequesterId, f.AddresseeId,
                       (SELECT MAX(CreatedAt) FROM Messages m WHERE (m.SenderId = u.Id AND m.ReceiverId = @userId) OR (m.SenderId = @userId AND m.ReceiverId = u.Id)) as LastMessageAt,
                       (SELECT COUNT(*) FROM Messages m WHERE m.SenderId = u.Id AND m.ReceiverId = @userId AND m.IsRead = 0) as UnreadCount
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

app.post('/api/messages/read', async (req, res) => {
    const { senderId, receiverId } = req.body;
    try {
        const pool = await poolPromise;
        await pool.request()
            .input('senderId', sql.Int, senderId)
            .input('receiverId', sql.Int, receiverId)
            .query('UPDATE Messages SET IsRead = 1, ReadAt = GETDATE() WHERE SenderId = @senderId AND ReceiverId = @receiverId AND IsRead = 0');
            
        io.emit('messagesRead', { senderId, receiverId });
        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

// Socket.io
const userSockets = new Map(); // userId -> Set of socketIds

io.on('connection', (socket) => {
    console.log('User connected:', socket.id);
    
    // Send current online users immediately upon connection
    socket.emit('onlineUsers', Array.from(userSockets.keys()));
    
    socket.on('join', (user) => {
        socket.user = user;
        const userId = parseInt(user.Id || user.id);
        if (!userSockets.has(userId)) userSockets.set(userId, new Set());
        userSockets.get(userId).add(socket.id);
        io.emit('onlineUsers', Array.from(userSockets.keys()));
        console.log(`${user.Username} joined (ID: ${userId})`);
    });
    


    socket.on('sendMessage', async (data) => {
        console.log("Received sendMessage payload:", data);
        const { senderId, receiverId, content, username, attachmentUrl } = data;
        
        try {
            const pool = await poolPromise;
            const result = await pool.request()
                .input('senderId', sql.Int, senderId)
                .input('receiverId', sql.Int, receiverId)
                .input('content', sql.NVarChar, content)
                .input('attachmentUrl', sql.NVarChar, attachmentUrl || null)
                .query('INSERT INTO Messages (SenderId, ReceiverId, Content, AttachmentUrl) OUTPUT INSERTED.Id, INSERTED.CreatedAt VALUES (@senderId, @receiverId, @content, @attachmentUrl)');
            
            const newMessage = {
                Id: result.recordset[0].Id,
                SenderId: senderId,
                ReceiverId: receiverId,
                Content: content,
                AttachmentUrl: attachmentUrl || null,
                CreatedAt: result.recordset[0].CreatedAt,
                Username: username
            };
            
            io.emit('receiveMessage', newMessage);
        } catch (err) {
            console.error('Error saving message:', err);
        }
    });

    socket.on('typing', ({ senderId, receiverId, isTyping }) => {
        io.emit('typing', { senderId, receiverId, isTyping });
    });

    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
        for (const [userId, sockets] of userSockets.entries()) {
            if (sockets.has(socket.id)) {
                sockets.delete(socket.id);
                if (sockets.size === 0) {
                    userSockets.delete(userId);
                }
                io.emit('onlineUsers', Array.from(userSockets.keys()));
                break;
            }
        }
    });
});

app.post('/api/upload', upload.single('file'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
    }
    const fileUrl = `http://${req.hostname}:5000/uploads/${req.file.filename}`;
    res.json({ url: fileUrl });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
