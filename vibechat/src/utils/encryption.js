import CryptoJS from 'crypto-js';

// Khóa bí mật nội bộ kết hợp thêm với IDs để tăng cường (Bảo vệ khỏi việc ai đó tự tính được khóa)
const SECRET_SALT = "VibeChat_Super_Secret_2026!";

/**
 * Sinh khóa chung (Shared Key) duy nhất cho 1 cặp người dùng
 * Dù A gửi B, hay B gửi A, khóa này đều sinh ra giống hệt nhau
 * do thuật toán sắp xếp ID.
 */
export const generateSharedKey = (user1Id, user2Id) => {
    // Sắp xếp 2 ID để đảm bảo tính đối xứng (ví dụ: 1 và 2 sẽ luôn ra khóa giống 2 và 1)
    const sortedIds = [user1Id, user2Id].sort((a, b) => a - b);
    const combinedString = `${sortedIds[0]}_${SECRET_SALT}_${sortedIds[1]}`;
    
    // Hash chuỗi đó để làm Secret Key cho AES
    return CryptoJS.SHA256(combinedString).toString(CryptoJS.enc.Hex);
};

/**
 * Mã hóa tin nhắn
 */
export const encryptMessage = (text, sharedKey) => {
    if (!text) return text;
    try {
        const cipherText = CryptoJS.AES.encrypt(text, sharedKey).toString();
        return cipherText;
    } catch (error) {
        console.error("Encryption failed:", error);
        return text;
    }
};

/**
 * Giải mã tin nhắn
 */
export const decryptMessage = (cipherText, sharedKey) => {
    if (!cipherText) return cipherText;
    try {
        const bytes = CryptoJS.AES.decrypt(cipherText, sharedKey);
        const originalText = bytes.toString(CryptoJS.enc.Utf8);
        
        // Trả về originalText nếu thành công, nếu thất bại (không cùng key) trả về báo lỗi
        return originalText || "Mật mã sai / Không thể đọc";
    } catch (error) {
        // Trong trường hợp tin nhắn cũ chưa bị mã hóa
        console.error("Decryption failed (might be old unencrypted message):", error);
        return cipherText;
    }
};
