const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
require('dotenv').config();
const { poolPromise, sql } = require('./db');

const app = express();
app.use(cors());
app.use(express.json());

const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir);
}
app.use('/uploads', express.static(uploadsDir));

// Multer Config
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads/');
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, (req.user ? req.user.id : 'user') + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });

const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

const { PeerServer } = require('peer');
const peerServer = PeerServer({
    port: 5001,
    path: '/myapp',
    corsOptions: { origin: '*' }
});
console.log('PeerJS standalone server running on port 5001');

// Auto-migrate Database
poolPromise.then(pool => {
    pool.request().query(`
        IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[Messages]') AND name = 'ImageUrl')
        ALTER TABLE Messages ADD ImageUrl NVARCHAR(MAX) NULL
    `).then(() => {
        console.log('Migrated Messages table (ImageUrl added)');
    }).catch(err => {
        console.error('Migration error:', err);
    });
}).catch(console.error);

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
        
        // Create Tasks table
        await pool.request().query(`
            IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='Tasks' and xtype='U')
            BEGIN
                CREATE TABLE Tasks (
                    Id INT IDENTITY(1,1) PRIMARY KEY,
                    UserId INT NOT NULL,
                    Title NVARCHAR(255) NOT NULL,
                    IsCompleted BIT DEFAULT 0,
                    CreatedAt DATETIME DEFAULT GETDATE(),
                    CONSTRAINT FK_Tasks_User FOREIGN KEY (UserId) REFERENCES Users(Id) ON DELETE CASCADE
                );
            END
        `);
        
        // Add new columns to Users if missing for Phase 2
        await pool.request().query(`
            IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[Users]') AND name = 'GoogleId')
                ALTER TABLE Users ADD GoogleId NVARCHAR(255) NULL;
            IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[Users]') AND name = 'FacebookId')
                ALTER TABLE Users ADD FacebookId NVARCHAR(255) NULL;
            IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[Users]') AND name = 'ResetToken')
                ALTER TABLE Users ADD ResetToken NVARCHAR(255) NULL;
            IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[Users]') AND name = 'ResetTokenExpiry')
                ALTER TABLE Users ADD ResetTokenExpiry DATETIME NULL;
        `);
        
        console.log('Database tables initialized/updated');
    } catch (err) {
        console.error('Failed to initialize db:', err);
    }
}
initDb();

// JWT Middleware
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (token == null) return res.status(401).json({ error: 'No token provided' });

    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ error: 'Invalid token' });
        req.user = user;
        next();
    });
}

// Routes
app.post('/api/messages/image', authenticateToken, upload.single('image'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
        const imageUrl = `/uploads/${req.file.filename}`;
        res.json({ imageUrl });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

app.post('/api/messages/file', authenticateToken, upload.single('file'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
        const fileUrl = `/uploads/${req.file.filename}`;
        const fileName = req.file.originalname;
        res.json({ fileUrl, fileName });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

app.post('/api/users/avatar', authenticateToken, upload.single('avatar'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
        const avatarUrl = `/uploads/${req.file.filename}`;
        
        const pool = await poolPromise;
        await pool.request()
            .input('avatarUrl', sql.NVarChar, avatarUrl)
            .input('userId', sql.Int, req.user.id)
            .query('UPDATE Users SET AvatarUrl = @avatarUrl WHERE Id = @userId');
            
        res.json({ avatarUrl });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

app.get('/api/auth/me', authenticateToken, async (req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request()
            .input('id', sql.Int, req.user.id)
            .query('SELECT Id, Username, FullName, DateOfBirth, Email, AvatarUrl, Bio, Status, LastLogin, IsActive, CreatedAt FROM Users WHERE Id = @id');
        
        if (result.recordset.length === 0) return res.status(404).json({ error: 'User not found' });
        res.json({ user: result.recordset[0] });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

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
            
        const userObj = insertResult.recordset[0];
        const token = jwt.sign({ id: userObj.Id, username: userObj.Username }, process.env.JWT_SECRET, { expiresIn: '7d' });
        res.json({ user: userObj, token });
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
        
        const token = jwt.sign({ id: user.Id, username: user.Username }, process.env.JWT_SECRET, { expiresIn: '7d' });
        res.json({ user, token });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

// Auth Extensions (Skeletons)
app.post('/api/auth/google', async (req, res) => {
    // Mock logic
    res.json({ message: "Google Login skeleton works", user: { Username: "GoogleUser" }, token: "mock_jwt_token" });
});

app.post('/api/auth/facebook', async (req, res) => {
    // Mock logic
    res.json({ message: "Facebook Login skeleton works", user: { Username: "FacebookUser" }, token: "mock_jwt_token" });
});

app.post('/api/auth/forgot-password', async (req, res) => {
    // Mock logic
    res.json({ message: "Password reset link sent (mock)" });
});

app.post('/api/auth/change-password', authenticateToken, async (req, res) => {
    const { oldPassword, newPassword } = req.body;
    if (!oldPassword || !newPassword) return res.status(400).json({ error: 'All fields are required' });
    try {
        const pool = await poolPromise;
        const result = await pool.request()
            .input('id', sql.Int, req.user.id)
            .query('SELECT Password FROM Users WHERE Id = @id');
            
        const user = result.recordset[0];
        if (!user || !user.Password) return res.status(400).json({ error: 'User not found or has no password' });
        
        const isMatch = await bcrypt.compare(oldPassword, user.Password);
        if (!isMatch) return res.status(400).json({ error: 'Incorrect old password' });
        
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(newPassword, salt);
        
        await pool.request()
            .input('id', sql.Int, req.user.id)
            .input('password', sql.NVarChar, hashedPassword)
            .query('UPDATE Users SET Password = @password WHERE Id = @id');
            
        res.json({ success: true, message: "Password changed successfully" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

app.get('/api/users/:currentUserId', authenticateToken, async (req, res) => {
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

app.get('/api/messages', authenticateToken, async (req, res) => {
    const { user1, user2 } = req.query;
    try {
        const pool = await poolPromise;
        let query = `
            SELECT m.Id, m.Content, m.ImageUrl, m.AttachmentUrl, m.CreatedAt, u.Username, u.FullName, u.AvatarUrl, m.SenderId, m.ReceiverId
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

// Tasks API
app.get('/api/tasks', authenticateToken, async (req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request()
            .input('userId', sql.Int, req.user.id)
            .query('SELECT * FROM Tasks WHERE UserId = @userId ORDER BY CreatedAt DESC');
        res.json(result.recordset);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

app.post('/api/tasks', authenticateToken, async (req, res) => {
    const { title } = req.body;
    try {
        const pool = await poolPromise;
        const result = await pool.request()
            .input('userId', sql.Int, req.user.id)
            .input('title', sql.NVarChar, title)
            .query('INSERT INTO Tasks (UserId, Title) OUTPUT INSERTED.* VALUES (@userId, @title)');
        res.json(result.recordset[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

app.put('/api/tasks/:id', authenticateToken, async (req, res) => {
    const { isCompleted } = req.body;
    try {
        const pool = await poolPromise;
        await pool.request()
            .input('id', sql.Int, req.params.id)
            .input('isCompleted', sql.Bit, isCompleted ? 1 : 0)
            .query('UPDATE Tasks SET IsCompleted = @isCompleted WHERE Id = @id');
        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

// Friendship Routes
app.get('/api/users/search', authenticateToken, async (req, res) => {
    const { q, currentUserId } = req.query;
    try {
        const pool = await poolPromise;
        const result = await pool.request()
            .input('q', sql.NVarChar, `%${q}%`)
            .input('currentUserId', sql.Int, currentUserId)
            .query(`
                SELECT u.Id, u.Username, u.FullName, u.AvatarUrl,
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

app.post('/api/friends/request', authenticateToken, async (req, res) => {
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

app.post('/api/friends/accept', authenticateToken, async (req, res) => {
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

app.get('/api/friends/:userId', authenticateToken, async (req, res) => {
    const { userId } = req.params;
    try {
        const pool = await poolPromise;
        const result = await pool.request()
            .input('userId', sql.Int, userId)
            .query(`
                SELECT u.Id, u.Username, u.FullName, u.AvatarUrl, f.Status, f.RequesterId, f.AddresseeId 
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
const onlineUsers = new Map(); // Map of userId -> socket.id

io.on('connection', (socket) => {
    console.log('User connected:', socket.id);
    
    socket.on('join', (user) => {
        socket.user = user;
        onlineUsers.set(user.Id, socket.id);
        console.log(`${user.Username} joined (ID: ${user.Id})`);
        
        // Broadcast to everyone that this user is online
        io.emit('userOnline', user.Id);
        
        // Send the list of all currently online users to the user who just joined
        socket.emit('onlineUsersList', Array.from(onlineUsers.keys()));
    });

    socket.on('sendMessage', async (data) => {
        const { senderId, receiverId, content, username, imageUrl } = data;
        
        try {
            const pool = await poolPromise;
            const result = await pool.request()
                .input('senderId', sql.Int, senderId)
                .input('receiverId', sql.Int, receiverId)
                .input('content', sql.NVarChar, content)
                .input('imageUrl', sql.NVarChar, imageUrl || null)
                .query('INSERT INTO Messages (SenderId, ReceiverId, Content, ImageUrl) OUTPUT INSERTED.Id, INSERTED.CreatedAt VALUES (@senderId, @receiverId, @content, @imageUrl)');
            
            const newMessage = {
                Id: result.recordset[0].Id,
                SenderId: senderId,
                ReceiverId: receiverId,
                Content: content,
                ImageUrl: imageUrl,
                AttachmentUrl: null,
                CreatedAt: result.recordset[0].CreatedAt,
                Username: username
            };
            
            // Send to receiver
            const receiverSocketId = onlineUsers.get(receiverId);
            if (receiverSocketId) {
                io.to(receiverSocketId).emit('receiveMessage', newMessage);
            }
            
            // Also send back to sender
            socket.emit('receiveMessage', newMessage);
        } catch (err) {
            console.error('Error saving message:', err);
        }
    });
    
    socket.on('sendFileMessage', async (data) => {
        const { senderId, receiverId, content, username, attachmentUrl } = data;
        
        try {
            const pool = await poolPromise;
            const result = await pool.request()
                .input('senderId', sql.Int, senderId)
                .input('receiverId', sql.Int, receiverId)
                .input('content', sql.NVarChar, content)
                .input('attachmentUrl', sql.NVarChar, attachmentUrl)
                .query('INSERT INTO Messages (SenderId, ReceiverId, Content, AttachmentUrl) OUTPUT INSERTED.Id, INSERTED.CreatedAt VALUES (@senderId, @receiverId, @content, @attachmentUrl)');
            
            const newMessage = {
                Id: result.recordset[0].Id,
                SenderId: senderId,
                ReceiverId: receiverId,
                Content: content,
                ImageUrl: null,
                AttachmentUrl: attachmentUrl,
                CreatedAt: result.recordset[0].CreatedAt,
                Username: username
            };
            
            // Send to receiver
            const receiverSocketId = onlineUsers.get(receiverId);
            if (receiverSocketId) {
                io.to(receiverSocketId).emit('receiveMessage', newMessage);
            }
            
            // Also send back to sender
            socket.emit('receiveMessage', newMessage);
        } catch (err) {
            console.error('Error saving file message:', err);
        }
    });

    socket.on('typing', ({ senderId, receiverId }) => {
        const receiverSocketId = onlineUsers.get(receiverId);
        if (receiverSocketId) {
            io.to(receiverSocketId).emit('typing', { senderId });
        }
    });

    socket.on('stopTyping', ({ senderId, receiverId }) => {
        const receiverSocketId = onlineUsers.get(receiverId);
        if (receiverSocketId) {
            io.to(receiverSocketId).emit('stopTyping', { senderId });
        }
    });

    // WebRTC Signaling
    socket.on('callUser', (data) => {
        const receiverSocketId = onlineUsers.get(data.userToCall);
        if (receiverSocketId) {
            io.to(receiverSocketId).emit('callUser', { signal: data.signalData, from: data.from, callerName: data.callerName });
        }
    });

    socket.on('answerCall', (data) => {
        const callerSocketId = onlineUsers.get(data.to);
        if (callerSocketId) {
            io.to(callerSocketId).emit('callAccepted', data.signal);
        }
    });

    socket.on('endCall', (data) => {
        const otherUserSocketId = onlineUsers.get(data.to);
        if (otherUserSocketId) {
            io.to(otherUserSocketId).emit('callEnded');
        }
    });

    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
        if (socket.user) {
            onlineUsers.delete(socket.user.Id);
            // Broadcast to everyone that this user went offline
            io.emit('userOffline', socket.user.Id);
        }
    });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
