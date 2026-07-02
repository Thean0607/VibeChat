-- ==============================================================
-- KỊCH BẢN TẠO CƠ SỞ DỮ LIỆU (DATABASE SCRIPT) CHO VIBECHAT
-- ==============================================================

-- 1. TẠO DATABASE (Bỏ comment 3 dòng dưới nếu bạn chưa có Database)
-- CREATE DATABASE VibeChatDB;
-- GO
-- USE VibeChatDB;
-- GO

-- ==============================================================
-- 2. TẠO BẢNG [Users] - Lưu trữ thông tin tài khoản người dùng
-- ==============================================================
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='Users' and xtype='U')
BEGIN
    CREATE TABLE Users (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        
        Username NVARCHAR(100) UNIQUE NOT NULL,
        Password NVARCHAR(255) NOT NULL, -- Lưu trữ mật khẩu đã mã hóa (Hash)
        
        FullName NVARCHAR(255) NULL,
        DateOfBirth DATE NULL,
        Email NVARCHAR(255) UNIQUE NULL,
        
        AvatarUrl NVARCHAR(500) NULL,
        Bio NVARCHAR(1000) NULL,
        Status NVARCHAR(50) DEFAULT 'offline', -- 'online', 'offline', 'away'
        LastLogin DATETIME NULL,
        
        IsActive BIT DEFAULT 1, -- Xóa mềm (Soft Delete)
        CreatedAt DATETIME DEFAULT GETDATE(),
        UpdatedAt DATETIME DEFAULT GETDATE()
    );
    
    -- Tạo Index để tăng tốc độ tìm kiếm
    CREATE NONCLUSTERED INDEX IX_Users_Username ON Users(Username);
    CREATE NONCLUSTERED INDEX IX_Users_Email ON Users(Email);
    
    PRINT 'Đã tạo bảng [Users] thành công.';
END
GO

-- ==============================================================
-- 3. TẠO BẢNG [Messages] - Lưu trữ tin nhắn Chat Realtime
-- ==============================================================
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='Messages' and xtype='U')
BEGIN
    CREATE TABLE Messages (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        SenderId INT NOT NULL,
        ReceiverId INT NOT NULL,
        Content NVARCHAR(MAX) NOT NULL,
        
        AttachmentUrl NVARCHAR(500) NULL, -- Cho phép gửi ảnh/file
        IsRead BIT DEFAULT 0,
        ReadAt DATETIME NULL,
        
        IsDeleted BIT DEFAULT 0, -- Xóa mềm tin nhắn
        CreatedAt DATETIME DEFAULT GETDATE(),
        UpdatedAt DATETIME DEFAULT GETDATE(),
        
        CONSTRAINT FK_Messages_Sender FOREIGN KEY (SenderId) REFERENCES Users(Id) ON DELETE CASCADE,
        CONSTRAINT FK_Messages_Receiver FOREIGN KEY (ReceiverId) REFERENCES Users(Id) ON DELETE NO ACTION
    );
    
    -- Tạo Index hỗ trợ lấy lịch sử tin nhắn nhanh hơn
    CREATE NONCLUSTERED INDEX IX_Messages_SenderReceiver ON Messages(SenderId, ReceiverId);
    CREATE NONCLUSTERED INDEX IX_Messages_CreatedAt ON Messages(CreatedAt);
    
    PRINT 'Đã tạo bảng [Messages] thành công.';
END
GO

-- ==============================================================
-- 4. TẠO BẢNG [Friendships] - Lưu trữ quan hệ Bạn bè / Lời mời
-- ==============================================================
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
        
        -- Ngăn chặn 2 người gửi lời mời lặp lại nhiều lần
        CONSTRAINT UQ_Friendships_Requester_Addressee UNIQUE (RequesterId, AddresseeId),
        
        -- Ràng buộc chỉ cho phép một số trạng thái nhất định
        CONSTRAINT CHK_Friendships_Status CHECK (Status IN ('pending', 'accepted', 'blocked', 'declined'))
    );
    
    -- Tạo Index cho việc query danh sách bạn bè
    CREATE NONCLUSTERED INDEX IX_Friendships_Requester ON Friendships(RequesterId);
    CREATE NONCLUSTERED INDEX IX_Friendships_Addressee ON Friendships(AddresseeId);
    
    PRINT 'Đã tạo bảng [Friendships] thành công.';
END
GO
