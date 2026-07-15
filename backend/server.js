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

const peerApp = express();
peerApp.use(cors());
const peerHttpServer = http.createServer(peerApp);
const { ExpressPeerServer } = require('peer');
const peerServer = ExpressPeerServer(peerHttpServer, {
    debug: true,
    path: '/myapp'
});
peerApp.use('/peerjs', peerServer);
peerHttpServer.listen(5001, () => {
    console.log('PeerJS server running on port 5001');
});

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
                    ReceiverId INT NULL,
                    GroupId INT NULL,
                    Content NVARCHAR(MAX) NOT NULL,
                    ImageUrl NVARCHAR(MAX) NULL,
                    AttachmentUrl NVARCHAR(500) NULL,
                    ReplyToMessageId INT NULL,
                    IsPinned BIT DEFAULT 0,
                    IsEdited BIT DEFAULT 0,
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
                IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[Messages]') AND name = 'GroupId')
                    ALTER TABLE Messages ADD GroupId INT NULL;
                IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[Messages]') AND name = 'AttachmentUrl')
                    ALTER TABLE Messages ADD AttachmentUrl NVARCHAR(500) NULL;
                IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[Messages]') AND name = 'ReplyToMessageId')
                    ALTER TABLE Messages ADD ReplyToMessageId INT NULL;
                IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[Messages]') AND name = 'IsPinned')
                    ALTER TABLE Messages ADD IsPinned BIT DEFAULT 0;
                IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[Messages]') AND name = 'IsEdited')
                    ALTER TABLE Messages ADD IsEdited BIT DEFAULT 0;
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
        
        // Create Groups table
        await pool.request().query(`
            IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='Groups' and xtype='U')
            BEGIN
                CREATE TABLE Groups (
                    Id INT IDENTITY(1,1) PRIMARY KEY,
                    Name NVARCHAR(255) NOT NULL,
                    AvatarUrl NVARCHAR(500) NULL,
                    AdminId INT NOT NULL,
                    CreatedAt DATETIME DEFAULT GETDATE(),
                    CONSTRAINT FK_Groups_Admin FOREIGN KEY (AdminId) REFERENCES Users(Id)
                );
            END
        `);

        // Create GroupMembers table
        await pool.request().query(`
            IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='GroupMembers' and xtype='U')
            BEGIN
                CREATE TABLE GroupMembers (
                    GroupId INT NOT NULL,
                    UserId INT NOT NULL,
                    Role NVARCHAR(50) DEFAULT 'member',
                    JoinedAt DATETIME DEFAULT GETDATE(),
                    PRIMARY KEY (GroupId, UserId),
                    CONSTRAINT FK_GroupMembers_Group FOREIGN KEY (GroupId) REFERENCES Groups(Id) ON DELETE CASCADE,
                    CONSTRAINT FK_GroupMembers_User FOREIGN KEY (UserId) REFERENCES Users(Id)
                );
            END
        `);

        // Create MessageReactions table
        await pool.request().query(`
            IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='MessageReactions' and xtype='U')
            BEGIN
                CREATE TABLE MessageReactions (
                    MessageId INT NOT NULL,
                    UserId INT NOT NULL,
                    ReactionType NVARCHAR(50) NOT NULL,
                    CreatedAt DATETIME DEFAULT GETDATE(),
                    PRIMARY KEY (MessageId, UserId),
                    CONSTRAINT FK_MessageReactions_Message FOREIGN KEY (MessageId) REFERENCES Messages(Id) ON DELETE CASCADE,
                    CONSTRAINT FK_MessageReactions_User FOREIGN KEY (UserId) REFERENCES Users(Id)
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

// Update profile
app.put('/api/users/profile', authenticateToken, async (req, res) => {
    try {
        const { FullName, Bio } = req.body;
        const pool = await poolPromise;
        await pool.request()
            .input('FullName', sql.NVarChar, FullName)
            .input('Bio', sql.NVarChar, Bio)
            .input('Id', sql.Int, req.user.id)
            .query(`
                UPDATE Users 
                SET FullName = @FullName, Bio = @Bio
                WHERE Id = @Id
            `);
        res.json({ message: 'Profile updated successfully' });
    } catch (err) {
        console.error('Error updating profile:', err);
        res.status(500).json({ error: 'Internal server error' });
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



// ==========================================
// PASSWORD RECOVERY APIS
// ==========================================
const resetTokens = new Map(); // Simple in-memory store for tokens (Use DB in production)

app.post('/api/auth/forgot-password', async (req, res) => {
    try {
        const { email } = req.body;
        const pool = await poolPromise;
        const result = await pool.request()
            .input('Email', sql.NVarChar, email)
            .query('SELECT Id FROM Users WHERE Email = @Email OR Username = @Email'); // Allow fallback to Username
            
        if (result.recordset.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        resetTokens.set(email, { otp, expires: Date.now() + 15 * 60 * 1000 });
        
        console.log(`[EMAIL SIMULATION] Password reset OTP for ${email} is: ${otp}`);
        
        res.json({ success: true, message: 'OTP sent to email (simulated in console)' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

app.post('/api/auth/reset-password', async (req, res) => {
    try {
        const { email, OTP, NewPassword } = req.body;
        const tokenData = resetTokens.get(email);
        
        if (!tokenData || tokenData.otp !== OTP || Date.now() > tokenData.expires) {
            return res.status(400).json({ error: 'Invalid or expired OTP' });
        }
        
        const hashedPassword = await bcrypt.hash(NewPassword, 10);
        const pool = await poolPromise;
        await pool.request()
            .input('Email', sql.NVarChar, email)
            .input('Password', sql.NVarChar, hashedPassword)
            .query('UPDATE Users SET Password = @Password WHERE Email = @Email OR Username = @Email');
            
        resetTokens.delete(email);
        res.json({ success: true, message: 'Password reset successfully' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
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

app.get('/api/users/search', authenticateToken, async (req, res) => {
    const { q, currentUserId } = req.query;
    try {
        const pool = await poolPromise;
        const request = pool.request();
        request.input('currentUserId', sql.Int, currentUserId);
        
        let query = `
            SELECT u.Id, u.Username, u.FullName, u.AvatarUrl,
                   f.Status, f.RequesterId, f.AddresseeId 
            FROM Users u
            LEFT JOIN Friendships f 
              ON (u.Id = f.RequesterId AND f.AddresseeId = @currentUserId) 
              OR (u.Id = f.AddresseeId AND f.RequesterId = @currentUserId)
            WHERE u.Id != @currentUserId 
        `;
        
        if (q && q.trim() !== '') {
            query += ` AND (u.Username LIKE @q OR u.FullName LIKE @q)`;
            request.input('q', sql.NVarChar, `%${q}%`);
        }
        
        console.log("EXEC QUERY:", query, "WITH currentUserId:", currentUserId, "q:", q);
        const result = await request.query(query);
        console.log("RESULT:", result.recordset);
        res.json(result.recordset);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

// Tasks APIs
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
// (Moved to top)

app.get('/api/friends/pending', authenticateToken, async (req, res) => {
    const { userId } = req.query;
    try {
        const pool = await poolPromise;
        const result = await pool.request()
            .input('userId', sql.Int, userId)
            .query(`
                SELECT u.Id, u.Username, u.FullName, u.AvatarUrl, f.RequesterId 
                FROM Users u
                JOIN Friendships f ON u.Id = f.RequesterId
                WHERE f.AddresseeId = @userId AND f.Status = 'pending'
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


// Block Friend
app.put('/api/friends/block', authenticateToken, async (req, res) => {
    const { userId, blockId } = req.body;
    try {
        const pool = await poolPromise;
        // Update Friendship to 'blocked'
        await pool.request()
            .input('RequesterId', sql.Int, userId)
            .input('AddresseeId', sql.Int, blockId)
            .query("UPDATE Friendships SET Status = 'blocked' WHERE (RequesterId = @RequesterId AND AddresseeId = @AddresseeId) OR (RequesterId = @AddresseeId AND AddresseeId = @RequesterId)");
        res.json({ message: 'User blocked successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Delete Chat History
app.delete('/api/messages/chat/:friendId', authenticateToken, async (req, res) => {
    const { friendId } = req.params;
    const userId = req.user.id;
    try {
        const pool = await poolPromise;
        // Physically delete messages
        await pool.request()
            .input('UserId', sql.Int, userId)
            .input('FriendId', sql.Int, friendId)
            .query("DELETE FROM Messages WHERE (SenderId = @UserId AND ReceiverId = @FriendId) OR (SenderId = @FriendId AND ReceiverId = @UserId)");
        res.json({ message: 'Chat deleted successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
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
        
        io.emit('userOnline', user.Id);
        socket.emit('onlineUsersList', Array.from(onlineUsers.keys()));
    });

    socket.on('sendMessage', async (data) => {
        const { senderId, receiverId, groupId, content, username, imageUrl, replyToMessageId } = data;
        
        try {
            const pool = await poolPromise;
            const req = pool.request()
                .input('senderId', sql.Int, senderId)
                .input('content', sql.NVarChar, content)
                .input('imageUrl', sql.NVarChar, imageUrl || null)
                .input('replyToMessageId', sql.Int, replyToMessageId || null);
                
            let query = '';
            if (groupId) {
                req.input('groupId', sql.Int, groupId);
                query = 'INSERT INTO Messages (SenderId, GroupId, Content, ImageUrl, ReplyToMessageId) OUTPUT INSERTED.Id, INSERTED.CreatedAt VALUES (@senderId, @groupId, @content, @imageUrl, @replyToMessageId)';
            } else {
                req.input('receiverId', sql.Int, receiverId);
                query = 'INSERT INTO Messages (SenderId, ReceiverId, Content, ImageUrl, ReplyToMessageId) OUTPUT INSERTED.Id, INSERTED.CreatedAt VALUES (@senderId, @receiverId, @content, @imageUrl, @replyToMessageId)';
            }

            const result = await req.query(query);
            
            const newMessage = {
                Id: result.recordset[0].Id,
                SenderId: senderId,
                ReceiverId: receiverId || null,
                GroupId: groupId || null,
                Content: content,
                ImageUrl: imageUrl,
                AttachmentUrl: null,
                ReplyToMessageId: replyToMessageId || null,
                IsPinned: false,
                IsEdited: false,
                Reactions: [],
                CreatedAt: result.recordset[0].CreatedAt,
                Username: username
            };
            
            if (groupId) {
                io.to(`group_${groupId}`).emit('receiveMessage', newMessage);
            } else {
                const receiverSocketId = onlineUsers.get(receiverId);
                if (receiverSocketId) {
                    io.to(receiverSocketId).emit('receiveMessage', newMessage);
                }
                socket.emit('receiveMessage', newMessage);
            }
        } catch (err) {
            console.error('Error saving message:', err);
        }
    });

    socket.on('sendFileMessage', async (data) => {
        const { senderId, receiverId, groupId, content, username, attachmentUrl, replyToMessageId } = data;
        try {
            const pool = await poolPromise;
            const req = pool.request()
                .input('senderId', sql.Int, senderId)
                .input('content', sql.NVarChar, content)
                .input('attachmentUrl', sql.NVarChar, attachmentUrl || null)
                .input('replyToMessageId', sql.Int, replyToMessageId || null);
                
            let query = '';
            if (groupId) {
                req.input('groupId', sql.Int, groupId);
                query = 'INSERT INTO Messages (SenderId, GroupId, Content, AttachmentUrl, ReplyToMessageId) OUTPUT INSERTED.Id, INSERTED.CreatedAt VALUES (@senderId, @groupId, @content, @attachmentUrl, @replyToMessageId)';
            } else {
                req.input('receiverId', sql.Int, receiverId);
                query = 'INSERT INTO Messages (SenderId, ReceiverId, Content, AttachmentUrl, ReplyToMessageId) OUTPUT INSERTED.Id, INSERTED.CreatedAt VALUES (@senderId, @receiverId, @content, @attachmentUrl, @replyToMessageId)';
            }

            const result = await req.query(query);
            
            const newMessage = {
                Id: result.recordset[0].Id,
                SenderId: senderId,
                ReceiverId: receiverId || null,
                GroupId: groupId || null,
                Content: content,
                ImageUrl: null,
                AttachmentUrl: attachmentUrl,
                ReplyToMessageId: replyToMessageId || null,
                IsPinned: false,
                IsEdited: false,
                Reactions: [],
                CreatedAt: result.recordset[0].CreatedAt,
                Username: username
            };
            
            if (groupId) {
                io.to(`group_${groupId}`).emit('receiveMessage', newMessage);
            } else {
                const receiverSocketId = onlineUsers.get(receiverId);
                if (receiverSocketId) {
                    io.to(receiverSocketId).emit('receiveMessage', newMessage);
                }
                socket.emit('receiveMessage', newMessage);
            }
        } catch (err) {
            console.error('Error saving file message:', err);
        }
    });

    socket.on('joinGroup', (groupId) => {
        socket.join(`group_${groupId}`);
        console.log(`User ${socket.user?.Username} joined group ${groupId}`);
    });
    
    socket.on('leaveGroup', (groupId) => {
        socket.leave(`group_${groupId}`);
        console.log(`User ${socket.user?.Username} left group ${groupId}`);
    });
    
    socket.on('typing', (data) => {
        const { senderId, receiverId, groupId, isTyping, username } = data;
        if (groupId) {
            socket.to(`group_${groupId}`).emit('typing', { senderId, groupId, isTyping, username });
        } else if (receiverId) {
            const receiverSocketId = onlineUsers.get(receiverId);
            if (receiverSocketId) {
                io.to(receiverSocketId).emit('typing', { senderId, isTyping, username });
            }
        }
    });

    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
        if (socket.user) {
            onlineUsers.delete(socket.user.Id);
            io.emit('userOffline', socket.user.Id);
        }
    });
});


// ==========================================
// GROUP CHAT APIS
// ==========================================

// Create a new group
app.post('/api/groups', authenticateToken, async (req, res) => {
    try {
        const { Name, AvatarUrl, MemberIds } = req.body;
        if (!Name || !MemberIds || !Array.isArray(MemberIds)) {
            return res.status(400).json({ error: 'Invalid group data' });
        }

        const pool = await poolPromise;
        
        // Use a transaction since we are inserting into two tables
        const transaction = new sql.Transaction(pool);
        await transaction.begin();

        try {
            // 1. Create Group
            const request = new sql.Request(transaction);
            request.input('Name', sql.NVarChar, Name);
            request.input('AvatarUrl', sql.NVarChar, AvatarUrl || null);
            request.input('AdminId', sql.Int, req.user.id);
            
            const groupResult = await request.query(`
                INSERT INTO Groups (Name, AvatarUrl, AdminId)
                OUTPUT INSERTED.Id, INSERTED.Name, INSERTED.AvatarUrl, INSERTED.AdminId, INSERTED.CreatedAt
                VALUES (@Name, @AvatarUrl, @AdminId)
            `);
            
            const newGroup = groupResult.recordset[0];
            const groupId = newGroup.Id;

            // 2. Add members to GroupMembers table
            // The admin is automatically a member with 'admin' role
            const allMembers = new Set([req.user.id, ...MemberIds]);
            
            for (const memberId of allMembers) {
                const memberReq = new sql.Request(transaction);
                memberReq.input('GroupId', sql.Int, groupId);
                memberReq.input('UserId', sql.Int, memberId);
                memberReq.input('Role', sql.NVarChar, memberId === req.user.id ? 'admin' : 'member');
                
                await memberReq.query(`
                    INSERT INTO GroupMembers (GroupId, UserId, Role)
                    VALUES (@GroupId, @UserId, @Role)
                `);
            }

            await transaction.commit();
            res.status(201).json(newGroup);
        } catch (err) {
            await transaction.rollback();
            throw err;
        }
    } catch (err) {
        console.error('Error creating group:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get user's groups
app.get('/api/groups', authenticateToken, async (req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request()
            .input('UserId', sql.Int, req.user.id)
            .query(`
                SELECT g.Id, g.Name, g.AvatarUrl, g.AdminId, g.CreatedAt, gm.Role, gm.JoinedAt
                FROM Groups g
                INNER JOIN GroupMembers gm ON g.Id = gm.GroupId
                WHERE gm.UserId = @UserId
            `);
        res.json(result.recordset);
    } catch (err) {
        console.error('Error fetching groups:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});


// ==========================================
// MESSAGE INTERACTION APIS (Phase 2)
// ==========================================

// React to a message
app.post('/api/messages/:id/react', authenticateToken, async (req, res) => {
    try {
        const messageId = req.params.id;
        const userId = req.user.id;
        const { reactionType } = req.body;
        
        const pool = await poolPromise;
        // Check if reaction exists
        const existing = await pool.request()
            .input('MessageId', sql.Int, messageId)
            .input('UserId', sql.Int, userId)
            .query('SELECT * FROM MessageReactions WHERE MessageId = @MessageId AND UserId = @UserId');
            
        if (existing.recordset.length > 0) {
            if (existing.recordset[0].ReactionType === reactionType) {
                // Remove reaction if same
                await pool.request()
                    .input('MessageId', sql.Int, messageId)
                    .input('UserId', sql.Int, userId)
                    .query('DELETE FROM MessageReactions WHERE MessageId = @MessageId AND UserId = @UserId');
            } else {
                // Update reaction
                await pool.request()
                    .input('MessageId', sql.Int, messageId)
                    .input('UserId', sql.Int, userId)
                    .input('ReactionType', sql.NVarChar, reactionType)
                    .query('UPDATE MessageReactions SET ReactionType = @ReactionType WHERE MessageId = @MessageId AND UserId = @UserId');
            }
        } else {
            // Add new reaction
            await pool.request()
                .input('MessageId', sql.Int, messageId)
                .input('UserId', sql.Int, userId)
                .input('ReactionType', sql.NVarChar, reactionType)
                .query('INSERT INTO MessageReactions (MessageId, UserId, ReactionType) VALUES (@MessageId, @UserId, @ReactionType)');
        }
        
        res.json({ success: true });
    } catch (err) {
        console.error('Error reacting to message:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Edit a message
app.put('/api/messages/:id', authenticateToken, async (req, res) => {
    try {
        const messageId = req.params.id;
        const { content } = req.body;
        
        const pool = await poolPromise;
        await pool.request()
            .input('Id', sql.Int, messageId)
            .input('Content', sql.NVarChar, content)
            .input('SenderId', sql.Int, req.user.id)
            .query('UPDATE Messages SET Content = @Content, IsEdited = 1 WHERE Id = @Id AND SenderId = @SenderId');
            
        res.json({ success: true });
    } catch (err) {
        console.error('Error editing message:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Pin a message
app.put('/api/messages/:id/pin', authenticateToken, async (req, res) => {
    try {
        const messageId = req.params.id;
        const { isPinned } = req.body;
        
        const pool = await poolPromise;
        await pool.request()
            .input('Id', sql.Int, messageId)
            .input('IsPinned', sql.Bit, isPinned ? 1 : 0)
            .query('UPDATE Messages SET IsPinned = @IsPinned WHERE Id = @Id');
            
        res.json({ success: true });
    } catch (err) {
        console.error('Error pinning message:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});


// ==========================================
// UX ENHANCEMENT APIS (Phase 4)
// ==========================================
app.get('/api/link-preview', authenticateToken, async (req, res) => {
    const { url } = req.query;
    if (!url) return res.status(400).json({ error: 'URL is required' });
    
    try {
        const response = await fetch(url);
        if (!response.ok) return res.status(400).json({ error: 'Failed to fetch URL' });
        
        const html = await response.text();
        
        // Simple regex parsing for basic meta tags
        const titleMatch = html.match(/<title>([^<]*)<\/title>/i) || html.match(/<meta property="og:title" content="([^"]*)"/i);
        const descMatch = html.match(/<meta property="og:description" content="([^"]*)"/i) || html.match(/<meta name="description" content="([^"]*)"/i);
        const imageMatch = html.match(/<meta property="og:image" content="([^"]*)"/i);
        
        const preview = {
            title: titleMatch ? titleMatch[1] : url,
            description: descMatch ? descMatch[1] : '',
            image: imageMatch ? imageMatch[1] : ''
        };
        
        res.json(preview);
    } catch (err) {
        console.error('Error fetching link preview:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});


// ==========================================
// RESTORED MISSING ROUTES
// ==========================================
app.get('/api/messages', authenticateToken, async (req, res) => {
    const { user1, user2, groupId } = req.query;
    try {
        const pool = await poolPromise;
        const request = pool.request();
        let query = `
            SELECT m.Id, m.Content, m.ImageUrl, m.AttachmentUrl, m.CreatedAt, 
                   u.Username, u.FullName, u.AvatarUrl, m.SenderId, m.ReceiverId, m.GroupId,
                   m.ReplyToMessageId, m.IsPinned, m.IsEdited,
                   (
                       SELECT r.ReactionType as Reaction, r.UserId, u2.FullName as Username
                       FROM MessageReactions r
                       JOIN Users u2 ON r.UserId = u2.Id
                       WHERE r.MessageId = m.Id
                       FOR JSON PATH
                   ) as Reactions
            FROM Messages m
            JOIN Users u ON m.SenderId = u.Id
        `;
        
        if (groupId) {
            query += ` WHERE m.GroupId = @groupId `;
            request.input('groupId', sql.Int, groupId);
        } else if (user1 && user2) {
            query += ` WHERE (m.SenderId = @user1 AND m.ReceiverId = @user2 AND m.GroupId IS NULL) 
                          OR (m.SenderId = @user2 AND m.ReceiverId = @user1 AND m.GroupId IS NULL) `;
            request.input('user1', sql.Int, user1);
            request.input('user2', sql.Int, user2);
        }
        
        query += ` ORDER BY m.CreatedAt ASC `;
        
        const result = await request.query(query);
        const messages = result.recordset.map(msg => ({
            ...msg,
            Reactions: msg.Reactions ? JSON.parse(msg.Reactions) : []
        }));
        res.json(messages);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

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

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
