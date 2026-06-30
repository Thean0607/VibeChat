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
        Password NVARCHAR(255) NOT NULL,
        
        FullName NVARCHAR(255) NULL,
        DateOfBirth DATE NULL,
        Email NVARCHAR(255) NULL,
        FacebookLink NVARCHAR(255) NULL,
        
        CreatedAt DATETIME DEFAULT GETDATE()
    );
    PRINT 'Đã tạo bảng [Users] thành công.';
END
GO

-- ==============================================================
-- 3. TẠO BẢNG [Messages] - Lưu trữ tin nhắn Chat Realtime (1-on-1)
-- ==============================================================
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='Messages' and xtype='U')
BEGIN
    CREATE TABLE Messages (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        SenderId INT NOT NULL,
        ReceiverId INT NOT NULL,
        Content NVARCHAR(MAX) NOT NULL,
        CreatedAt DATETIME DEFAULT GETDATE(),
        
        CONSTRAINT FK_Messages_Sender FOREIGN KEY (SenderId) REFERENCES Users(Id) ON DELETE CASCADE,
        CONSTRAINT FK_Messages_Receiver FOREIGN KEY (ReceiverId) REFERENCES Users(Id) ON DELETE NO ACTION
    );
    PRINT 'Đã tạo bảng [Messages] thành công.';
END
ELSE
BEGIN
    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[Messages]') AND name = 'ReceiverId')
        ALTER TABLE Messages ADD ReceiverId INT NULL;
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
        Status NVARCHAR(50) DEFAULT 'pending', -- 'pending' hoặc 'accepted'
        CreatedAt DATETIME DEFAULT GETDATE(),
        
        CONSTRAINT FK_Friendships_Requester FOREIGN KEY (RequesterId) REFERENCES Users(Id) ON DELETE CASCADE,
        CONSTRAINT FK_Friendships_Addressee FOREIGN KEY (AddresseeId) REFERENCES Users(Id) ON DELETE NO ACTION
    );
    PRINT 'Đã tạo bảng [Friendships] thành công.';
END
GO
