import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { socket } from '../socket';
import { 
    LogOut, User as UserIcon, MessageSquare, Users, 
    Settings, Search, 
    Home, Video, Menu, CheckCheck, Phone, MonitorUp, Paperclip, Folder, Smile, Plus, Bold, Code, List, Camera, Mic, Sticker, ChevronDown, Edit2,
    BellOff, Ban, Trash2, ChevronRight, FileText, Link, Image as ImageIcon
} from 'lucide-react';
import EmojiPicker from 'emoji-picker-react';
import Peer from 'peerjs';
import './Chat.css';

const Chat = ({ user, setUser }) => {
    const [activeTab, setActiveTab] = useState('chats'); // 'chats', 'people', 'profile', 'settings'
    const [friendsList, setFriendsList] = useState([]);
    const [searchMessageTerm, setSearchMessageTerm] = useState('');
    const [mutedUsers, setMutedUsers] = useState(() => JSON.parse(localStorage.getItem('mutedUsers') || '[]'));
    const [confirmDialog, setConfirmDialog] = useState({ isOpen: false, title: '', message: '', onConfirm: null });
    const [searchResults, setSearchResults] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [isDarkMode, setIsDarkMode] = useState(localStorage.getItem('isDarkMode') === 'true');
    const [soundEnabled, setSoundEnabled] = useState(localStorage.getItem('soundEnabled') !== 'false');
    const [showStatus, setShowStatus] = useState(localStorage.getItem('showStatus') !== 'false');
    const [language, setLanguage] = useState(localStorage.getItem('language') || 'English');
    const [isLangDropdownOpen, setIsLangDropdownOpen] = useState(false);
    
    // Profile Edit State
    const [isEditingProfile, setIsEditingProfile] = useState(false);
    const [editProfileData, setEditProfileData] = useState({ FullName: '', Bio: '' });

    const t = {
        English: { conversation: "Conversation", muteNotif: "Mute Notification", blockUser: "Block User", deleteChat: "Delete Chat", searchMessages: "SEARCH MESSAGES", searchDots: "Search...", sharedMedia: "SHARED MEDIA", viewAll: "View all", settings: "Settings", darkMode: "Dark Mode", soundNotif: "Sound Notifications", showOnline: "Show Online Status", lang: "Language", changePwd: "Change Password", logOut: "Log Out", oldPwd: "Old Password", newPwd: "New Password", confirmPwd: "Confirm New Password", update: "Update", cancel: "Cancel", home: "Home", chats: "Chats", people: "People", chatList: "Chat List", search: "Search", allChats: "All Chats", clickToView: "Click to view messages", selectChat: "Select a chat", selectChatDesc: "Choose a friend from the left panel to start messaging.", typeMessage: "Type a message...", send: "Send", voiceMsg: "Voice message", cancelMsg: "Cancel", sendFile: "Send file", sendVoice: "Send voice message", welcome: "Welcome Home", homeDesc: "Your dashboard is empty right now.", online: "Online", offline: "Offline", typing: "Typing", shareScreen: "Share Screen", videoCall: "Video Call", audioCall: "Audio Call", noMessages: "No messages yet. Say hi!", you: "You", downloadFile: "Download File", read: "Read", attachImage: "Attach Image", attachDoc: "Attach Document", record: "Hold/Click to Record" },
        Vietnamese: { conversation: "Cuộc trò chuyện", muteNotif: "Tắt thông báo", blockUser: "Chặn người dùng", deleteChat: "Xóa cuộc trò chuyện", searchMessages: "TÌM KIẾM TIN NHẮN", searchDots: "Tìm kiếm...", sharedMedia: "FILE PHƯƠNG TIỆN", viewAll: "Xem tất cả", settings: "Cài đặt", darkMode: "Nền tối", soundNotif: "Âm thanh thông báo", showOnline: "Hiển thị Online", lang: "Ngôn ngữ", changePwd: "Đổi mật khẩu", logOut: "Đăng xuất", oldPwd: "Mật khẩu cũ", newPwd: "Mật khẩu mới", confirmPwd: "Xác nhận mật khẩu", update: "Cập nhật", cancel: "Hủy", home: "Trang chủ", chats: "Tin nhắn", people: "Mọi người", chatList: "Danh sách chat", search: "Tìm kiếm", allChats: "Tất cả tin nhắn", clickToView: "Bấm để xem tin nhắn", selectChat: "Chọn một đoạn chat", selectChatDesc: "Chọn một người bạn ở danh sách bên trái để bắt đầu trò chuyện.", typeMessage: "Nhập tin nhắn...", send: "Gửi", voiceMsg: "Tin nhắn thoại", cancelMsg: "Hủy", sendFile: "Gửi file", sendVoice: "Gửi tin nhắn thoại", welcome: "Chào mừng bạn", homeDesc: "Bảng điều khiển của bạn hiện đang trống.", online: "Trực tuyến", offline: "Ngoại tuyến", typing: "Đang gõ", shareScreen: "Chia sẻ màn hình", videoCall: "Gọi Video", audioCall: "Gọi thoại", noMessages: "Chưa có tin nhắn nào. Hãy gửi lời chào!", you: "Bạn", downloadFile: "Tải file", read: "Đã xem", attachImage: "Gửi ảnh", attachDoc: "Gửi tài liệu", record: "Nhấn/Giữ để Thu âm" },
        Japanese: { conversation: "会話", muteNotif: "通知をミュート", blockUser: "ユーザーをブロック", deleteChat: "チャットを削除", searchMessages: "メッセージを検索", searchDots: "検索...", sharedMedia: "共有メディア", viewAll: "すべて見る", settings: "設定", darkMode: "ダークモード", soundNotif: "通知音", showOnline: "オンライン表示", lang: "言語", changePwd: "パスワード変更", logOut: "ログアウト", oldPwd: "現在のパスワード", newPwd: "新しいパスワード", confirmPwd: "パスワードの確認", update: "更新", cancel: "キャンセル", home: "ホーム", chats: "チャット", people: "人々", chatList: "チャットリスト", search: "検索", allChats: "すべてのチャット", clickToView: "クリックしてメッセージを表示", selectChat: "チャットを選択", selectChatDesc: "左側のパネルから友達を選んでメッセージを開始します。", typeMessage: "メッセージを入力...", send: "送信", voiceMsg: "ボイスメッセージ", cancelMsg: "キャンセル", sendFile: "ファイルを送信", sendVoice: "ボイスメッセージを送信", welcome: "ようこそ", homeDesc: "ダッシュボードは現在空です。", online: "オンライン", offline: "オフライン", typing: "入力中", shareScreen: "画面共有", videoCall: "ビデオ通話", audioCall: "音声通話", noMessages: "メッセージはまだありません。挨拶しましょう！", you: "あなた", downloadFile: "ファイルをダウンロード", read: "既読", attachImage: "画像を添付", attachDoc: "ドキュメントを添付", record: "録音する" }
    };
    const getText = (key) => t[language]?.[key] || t['English'][key];
    const [isRecording, setIsRecording] = useState(false);
    const [showStickerPicker, setShowStickerPicker] = useState(false);
    const [groups, setGroups] = useState([]);
    const [isOffline, setIsOffline] = useState(!navigator.onLine);


    const [replyingTo, setReplyingTo] = useState(null);
    const [hoveredMessageId, setHoveredMessageId] = useState(null);
    const [hasMore, setHasMore] = useState(true);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const messagesAreaRef = useRef(null);

    const [isCreateGroupModalOpen, setIsCreateGroupModalOpen] = useState(false);
    const [newGroupName, setNewGroupName] = useState('');
    const [newGroupMembers, setNewGroupMembers] = useState([]);

    const mediaRecorderRef = useRef(null);
    const audioChunksRef = useRef([]);

    const STICKERS = [
        'https://media.giphy.com/media/l4pTfx2qLszoacZRS/giphy.gif',
        'https://media.giphy.com/media/3o7TKSjRrfIPjeiVyM/giphy.gif',
        'https://media.giphy.com/media/26AHONQ79FdWZhAI0/giphy.gif',
        'https://media.giphy.com/media/3oEjI6SIIHBdRxXI40/giphy.gif',
        'https://media.giphy.com/media/JIX9t2j0ZTN9S/giphy.gif'
    ];
    
    const [selectedFriend, setSelectedFriend] = useState(null);
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState('');
    const [onlineUsers, setOnlineUsers] = useState(new Set());
    const [isTyping, setIsTyping] = useState(false);
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    const [unreadCounts, setUnreadCounts] = useState({});
    const [tasks, setTasks] = useState([]);
    const [newTaskTitle, setNewTaskTitle] = useState('');
    const [incomingCall, setIncomingCall] = useState(null);
    // eslint-disable-next-line no-unused-vars
    const [isCalling, setIsCalling] = useState(false);

    // WebRTC State
    const [peer, setPeer] = useState(null);
    const [myStream, setMyStream] = useState(null);
    const [remoteStream, setRemoteStream] = useState(null);
    const [callActive, setCallActive] = useState(false);
    
    // Change password state
    const [oldPassword, setOldPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [changePasswordMsg, setChangePasswordMsg] = useState('');
    const [showPasswordModal, setShowPasswordModal] = useState(false);
    
    const messagesEndRef = useRef(null);
    const typingTimeoutRef = useRef(null);
    const myVideoRef = useRef(null);
    const remoteVideoRef = useRef(null);
    const currentCallRef = useRef(null);
    const navigate = useNavigate();

    useEffect(() => {
        localStorage.setItem('isDarkMode', isDarkMode);
        localStorage.setItem('soundEnabled', soundEnabled);
        localStorage.setItem('showStatus', showStatus);
        localStorage.setItem('language', language);
        
        if (isDarkMode) {
            document.body.classList.add('dark-theme');
        } else {
            document.body.classList.remove('dark-theme');
        }
    }, [isDarkMode, soundEnabled, showStatus, language]);

    // Fetch friendships and tasks
    const fetchFriends = useCallback(async () => {
        if (!user) return;
        try {
            const response = await axios.get(`http://${window.location.hostname}:5000/api/friends/${user.Id}`);
            setFriendsList(response.data);
        } catch (err) {
            console.error("Failed to fetch friends", err);
        }
    }, [user]);

    const fetchTasks = useCallback(async () => {
        if (!user) return;
        try {
            const response = await axios.get(`http://${window.location.hostname}:5000/api/tasks`);
            setTasks(response.data);
        } catch (err) {
            console.error("Failed to fetch tasks", err);
        }
    }, [user]);

    useEffect(() => {
        if (!user) {
            navigate('/');
            return;
        }
        fetchFriends();
        fetchTasks();
    }, [user, navigate, fetchFriends, fetchTasks]);

    // Handle search users
    useEffect(() => {
        if (activeTab === 'people') {
            const delayDebounceFn = setTimeout(async () => {
                try {
                    const response = await axios.get(`http://${window.location.hostname}:5000/api/users/search?q=${searchQuery.trim()}&currentUserId=${user.Id}`);
                    setSearchResults(response.data);
                } catch (err) {
                    console.error(err);
                }
            }, 300);
            return () => clearTimeout(delayDebounceFn);
        }
    }, [searchQuery, activeTab, user]);

    // Friend actions
    const sendFriendRequest = async (addresseeId) => {
        try {
            await axios.post(`http://${window.location.hostname}:5000/api/friends/request`, {
                requesterId: user.Id,
                addresseeId
            });
            setSearchResults(prev => prev.map(u => u.Id === addresseeId ? { ...u, Status: 'pending' } : u));
        } catch (err) {
            console.error(err);
        }
    };

    const acceptFriendRequest = async (requesterId) => {
        try {
            await axios.post(`http://${window.location.hostname}:5000/api/friends/accept`, {
                requesterId,
                addresseeId: user.Id
            });
            fetchFriends();
            setSearchResults(prev => prev.map(u => u.Id === requesterId ? { ...u, Status: 'accepted' } : u));
        } catch (err) {
            console.error(err);
        }
    };
    // Messages
    useEffect(() => {
        if (!selectedFriend || !user) return;
        setMessages([]);
        setHasMore(true);
        const fetchMessages = async () => {
            try {
                let url = `http://${window.location.hostname}:5000/api/messages?limit=20&`;
                if (selectedFriend.IsGroup) {
                    url += `groupId=${selectedFriend.Id}`;
                } else {
                    url += `user1=${user.Id}&user2=${selectedFriend.Id}`;
                }
                const response = await axios.get(url, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });
                setMessages(response.data);
                if (response.data.length < 20) setHasMore(false);
            } catch (err) {
                console.error("Failed to fetch messages", err);
            }
        };
        fetchMessages();
    }, [selectedFriend, user]);

    const handleScroll = async () => {
        if (!messagesAreaRef.current || isLoadingMore || !hasMore || messages.length === 0) return;
        
        if (messagesAreaRef.current.scrollTop === 0) {
            setIsLoadingMore(true);
            const oldestMessageId = messages[0].Id;
            const previousScrollHeight = messagesAreaRef.current.scrollHeight;
            
            try {
                let url = `http://${window.location.hostname}:5000/api/messages?limit=20&beforeId=${oldestMessageId}&`;
                if (selectedFriend.IsGroup) {
                    url += `groupId=${selectedFriend.Id}`;
                } else {
                    url += `user1=${user.Id}&user2=${selectedFriend.Id}`;
                }
                const response = await axios.get(url, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });
                
                if (response.data.length < 20) {
                    setHasMore(false);
                }
                
                if (response.data.length > 0) {
                    setMessages(prev => [...response.data, ...prev]);
                    // Restore scroll position
                    requestAnimationFrame(() => {
                        if (messagesAreaRef.current) {
                            const newScrollHeight = messagesAreaRef.current.scrollHeight;
                            messagesAreaRef.current.scrollTop = newScrollHeight - previousScrollHeight;
                        }
                    });
                }
            } catch (err) {
                console.error("Failed to fetch older messages", err);
            } finally {
                setIsLoadingMore(false);
            }
        }
    };

    const playNotificationSound = () => {
        if (localStorage.getItem('soundEnabled') === 'false') return;
        try {
            const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            const oscillator = audioCtx.createOscillator();
            const gainNode = audioCtx.createGain();
            oscillator.type = 'sine';
            oscillator.frequency.setValueAtTime(880, audioCtx.currentTime);
            oscillator.frequency.exponentialRampToValueAtTime(440, audioCtx.currentTime + 0.1);
            gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);
            oscillator.connect(gainNode);
            gainNode.connect(audioCtx.destination);
            oscillator.start();
            oscillator.stop(audioCtx.currentTime + 0.1);
        } catch (e) {
            console.error("Audio failed", e);
        }
    };

    // Socket
    useEffect(() => {
        const handleReceiveMessage = (message) => {
            if (
                (selectedFriend && !selectedFriend.IsGroup && (message.SenderId == selectedFriend.Id || message.ReceiverId == selectedFriend.Id || (message.SenderId == user.Id && message.ReceiverId == selectedFriend.Id))) ||
                (selectedFriend && selectedFriend.IsGroup && message.GroupId == selectedFriend.Id)
            ) {
                setMessages(prev => [...prev, message]);
                if (message.SenderId != user.Id) playNotificationSound();
            } else if (message.SenderId != user.Id) {
                if (localStorage.getItem('soundEnabled') !== 'false') {
                    const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
                    audio.play().catch(e => console.error("Audio play error", e));
                }
                
                setUnreadCounts(prev => ({
                    ...prev,
                    [message.SenderId || message.GroupId]: (prev[message.SenderId || message.GroupId] || 0) + 1
                }));
            }
        };

        const handleConnect = () => {
            if (user) socket.emit('join', user);
        };

        const handleOnlineUsersList = (statusList) => {
            setOnlineUsers(new Set(statusList));
        };
        
        const handleUserOnline = (userId) => {
            setOnlineUsers(prev => {
                const newSet = new Set(prev);
                newSet.add(userId);
                return newSet;
            });
        };

        const handleUserOffline = (userId) => {
            setOnlineUsers(prev => {
                const newSet = new Set(prev);
                newSet.delete(userId);
                return newSet;
            });
        };

        const handleTyping = (data) => {
            if (selectedFriend && ((data.groupId && selectedFriend.IsGroup && selectedFriend.Id == data.groupId) || (!selectedFriend.IsGroup && data.senderId == selectedFriend.Id))) {
                setIsTyping(data.isTyping);
            }
        };

        socket.on('connect', handleConnect);
        socket.on('receiveMessage', handleReceiveMessage);
        socket.on('onlineUsersList', handleOnlineUsersList);
        socket.on('userOnline', handleUserOnline);
        socket.on('userOffline', handleUserOffline);
        socket.on('typing', handleTyping);
        
        if (socket.connected && user) {
            socket.emit('join', user);
        }
        
        return () => {
            socket.off('connect', handleConnect);
            socket.off('receiveMessage', handleReceiveMessage);
            socket.off('onlineUsersList', handleOnlineUsersList);
            socket.off('userOnline', handleUserOnline);
            socket.off('userOffline', handleUserOffline);
            socket.off('typing', handleTyping);
        };
    }, [selectedFriend, user]);

    // PeerJS Init
    useEffect(() => {
        if (!user) return;
        const newPeer = new Peer(user.Id.toString(), {
            host: window.location.hostname,
            port: 5001,
            path: '/peerjs/myapp'
        });
        setPeer(newPeer);
        
        newPeer.on('call', (call) => {
            setIncomingCall({
                call,
                callerName: call.metadata?.callerName || 'Friend',
                isVideo: call.metadata?.isVideo || false
            });
        });
        
        return () => {
            newPeer.destroy();
        };
    }, [user]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    
    const handleReact = async (msgId, type) => {
        try {
            await axios.post(`http://${window.location.hostname}:5000/api/messages/${msgId}/react`, { reactionType: type }, {
                headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
            });
            
            // Fetch updated messages
            let url = `http://${window.location.hostname}:5000/api/messages?`;
            if (selectedFriend.IsGroup) {
                url += `groupId=${selectedFriend.Id}`;
            } else {
                url += `user1=${user.Id}&user2=${selectedFriend.Id}`;
            }
            const response = await axios.get(url, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });
            setMessages(response.data);
        } catch (err) { console.error('Error reacting', err); }
    };
    
    const handlePin = async (msgId, isPinned) => {
        try {
            await axios.put(`http://${window.location.hostname}:5000/api/messages/${msgId}/pin`, { isPinned: !isPinned }, {
                headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
            });
            fetchMessages();
        } catch (err) { console.error('Error pinning', err); }
    };

    const handleSendMessage = (e) => {
        e.preventDefault();
        if (newMessage.trim() || replyingTo) {
            socket.emit('sendMessage', {
                senderId: user.Id,
                receiverId: selectedFriend.IsGroup ? null : selectedFriend.Id,
                groupId: selectedFriend.IsGroup ? selectedFriend.Id : null,
                content: newMessage,
                username: user.Username,
                replyToMessageId: replyingTo?.Id || null
            });
            setNewMessage('');
            setReplyingTo(null);
        }
    };

    const handleSelectFriend = (friend) => {
        setSelectedFriend(friend);
        setUnreadCounts(prev => {
            const next = {...prev};
            delete next[friend.Id];
            return next;
        });
    };

    const handleAvatarUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const formData = new FormData();
        formData.append('avatar', file);

        try {
            const response = await axios.post(`http://${window.location.hostname}:5000/api/users/avatar`, formData, {
                headers: { 
                    'Authorization': `Bearer ${localStorage.getItem('token')}`,
                    'Content-Type': 'multipart/form-data'
                }
            });
            setUser(prev => ({ ...prev, AvatarUrl: response.data.avatarUrl }));
            localStorage.setItem('user', JSON.stringify({ ...user, AvatarUrl: response.data.avatarUrl }));
        } catch (err) {
            console.error('Failed to upload avatar:', err);
            alert('Failed to upload avatar');
        }
    };

    const handleSaveProfile = async () => {
        try {
            await axios.put(`http://${window.location.hostname}:5000/api/users/profile`, editProfileData, {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            });
            const updatedUser = { ...user, ...editProfileData };
            setUser(updatedUser);
            localStorage.setItem('user', JSON.stringify(updatedUser));
            setIsEditingProfile(false);
        } catch (err) {
            console.error('Failed to save profile:', err);
            alert('Failed to save profile');
        }
    };

    
    const fetchGroups = async () => {
        try {
            const res = await axios.get(`http://${window.location.hostname}:5000/api/groups`, {
                headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
            });
            setGroups(res.data);
            socket.emit('joinGroups', res.data.map(g => g.Id));
        } catch (err) {
            console.error('Failed to fetch groups:', err);
        }
    };

    const handleCreateGroup = async () => {
        if (!newGroupName.trim() || newGroupMembers.length === 0) {
            alert("Please enter a group name and select at least one member.");
            return;
        }
        try {
            const res = await axios.post(`http://${window.location.hostname}:5000/api/groups`, {
                Name: newGroupName,
                MemberIds: newGroupMembers
            }, {
                headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
            });
            
            setGroups([...groups, res.data]);
            socket.emit('joinGroups', [res.data.Id]);
            setIsCreateGroupModalOpen(false);
            setNewGroupName('');
            setNewGroupMembers([]);
        } catch (err) {
            console.error('Failed to create group:', err);
            alert('Failed to create group');
        }
    };

    useEffect(() => {
        if (activeTab === 'chats') {
            fetchGroups();
        }
    }, [activeTab]);

const handleMessageChange = (e) => {
        setNewMessage(e.target.value);
        if (!selectedFriend) return;

        socket.emit('typing', { senderId: user.Id, receiverId: selectedFriend.IsGroup ? null : selectedFriend.Id, groupId: selectedFriend.IsGroup ? selectedFriend.Id : null });

        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);

        typingTimeoutRef.current = setTimeout(() => {
            socket.emit('stopTyping', { senderId: user.Id, receiverId: selectedFriend.IsGroup ? null : selectedFriend.Id, groupId: selectedFriend.IsGroup ? selectedFriend.Id : null });
        }, 1500);
    };

    const handleImageUpload = async (e) => {
        const file = e.target.files[0];
        if (!file || !selectedFriend) return;

        const formData = new FormData();
        formData.append('image', file);

        try {
            const response = await axios.post(`http://${window.location.hostname}:5000/api/messages/image`, formData, {
                headers: { 'Content-Type': 'multipart/form-data', 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            });
            
            socket.emit('sendMessage', {
                senderId: user.Id,
                receiverId: selectedFriend.IsGroup ? null : selectedFriend.Id,
                groupId: selectedFriend.IsGroup ? selectedFriend.Id : null,
                content: 'Sent an image',
                imageUrl: response.data.imageUrl,
                username: user.Username,
                replyToMessageId: replyingTo?.Id || null
            });
        } catch (err) {
            console.error('Failed to upload image:', err);
            alert('Failed to upload image');
        }
    };

    const handleDocumentUpload = async (e) => {
        const file = e.target.files[0];
        if (!file || !selectedFriend) return;

        const formData = new FormData();
        formData.append('file', file);

        try {
            const response = await axios.post(`http://${window.location.hostname}:5000/api/messages/file`, formData, {
                headers: { 'Content-Type': 'multipart/form-data', 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            });
            
            socket.emit('sendFileMessage', {
                senderId: user.Id,
                receiverId: selectedFriend.IsGroup ? null : selectedFriend.Id,
                groupId: selectedFriend.IsGroup ? selectedFriend.Id : null,
                content: `Sent a file`,
                attachmentUrl: response.data.fileUrl,
                username: user.Username,
                replyToMessageId: replyingTo?.Id || null
            });
        } catch (err) {
            console.error('Failed to upload document:', err);
            alert('Failed to upload document');
        }
    };

    const handleVoiceRecord = () => {
        if (!selectedFriend) return;
        if (isRecording) {
            mediaRecorderRef.current.stop();
            setIsRecording(false);
        } else {
            navigator.mediaDevices.getUserMedia({ audio: true }).then(stream => {
                const mediaRecorder = new MediaRecorder(stream);
                mediaRecorderRef.current = mediaRecorder;
                audioChunksRef.current = [];

                mediaRecorder.ondataavailable = (e) => {
                    audioChunksRef.current.push(e.data);
                };

                mediaRecorder.onstop = async () => {
                    const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
                    const formData = new FormData();
                    formData.append('file', audioBlob, 'voice.webm');

                    try {
                        const res = await axios.post(`http://${window.location.hostname}:5000/api/messages/file`, formData, {
                            headers: { 'Content-Type': 'multipart/form-data', 'Authorization': `Bearer ${localStorage.getItem('token')}` }
                        });
                        socket.emit('sendFileMessage', {
                            senderId: user.Id,
                            receiverId: selectedFriend.IsGroup ? null : selectedFriend.Id,
                            groupId: selectedFriend.IsGroup ? selectedFriend.Id : null,
                            content: 'Voice message',
                            attachmentUrl: res.data.fileUrl,
                            username: user.Username,
                            replyToMessageId: replyingTo?.Id || null
                        });
                    } catch (error) {
                        console.error('Error uploading voice msg', error);
                    }
                    stream.getTracks().forEach(track => track.stop());
                };

                mediaRecorder.start();
                setIsRecording(true);
            }).catch(console.error);
        }
    };

    const sendSticker = (url) => {
        if (!selectedFriend) return;
        socket.emit('sendMessage', {
            senderId: user.Id,
            receiverId: selectedFriend.IsGroup ? null : selectedFriend.Id,
            groupId: selectedFriend.IsGroup ? selectedFriend.Id : null,
            content: 'Sent a sticker',
            imageUrl: url,
            username: user.Username,
            replyToMessageId: replyingTo?.Id || null
        });
        setShowStickerPicker(false);
    };

    const initiateCall = async (callType) => {
        const isVideo = callType === 'video';
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: isVideo, audio: true });
            setMyStream(stream);
            setCallActive(true);
            
            if (peer && selectedFriend) {
                const call = peer.call(selectedFriend.Id.toString(), stream, {
                    metadata: { callerName: user.Username, isVideo }
                });
                
                if (!call) {
                    alert("Could not connect to the peer server to place the call.");
                    endCall();
                    return;
                }
                
                currentCallRef.current = call;
                
                call.on('stream', (userVideoStream) => {
                    setRemoteStream(userVideoStream);
                });
                
                call.on('close', () => {
                    endCall();
                });
            }
        } catch (err) {
            console.error("Failed to get local stream", err);
            alert("Could not access camera/microphone");
        }
    };

    const acceptCall = async () => {
        if (!incomingCall || !incomingCall.call) return;
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: incomingCall.isVideo, audio: true });
            setMyStream(stream);
            setCallActive(true);
            
            const call = incomingCall.call;
            currentCallRef.current = call;
            
            call.answer(stream);
            
            call.on('stream', (userVideoStream) => {
                setRemoteStream(userVideoStream);
            });
            
            call.on('close', () => {
                endCall();
            });
            
            setIncomingCall(null);
        } catch (err) {
            console.error("Failed to get local stream", err);
            alert("Could not access camera/microphone");
        }
    };

    const endCall = () => {
        if (currentCallRef.current) {
            currentCallRef.current.close();
            currentCallRef.current = null;
        }
        if (myStream) {
            myStream.getTracks().forEach(track => track.stop());
            setMyStream(null);
        }
        setRemoteStream(null);
        setCallActive(false);
        setIsCalling(false);
        setIncomingCall(null);
    };

    
    const handleMuteUser = () => {
        const newMuted = mutedUsers.includes(selectedFriend.Id)
            ? mutedUsers.filter(id => id !== selectedFriend.Id)
            : [...mutedUsers, selectedFriend.Id];
        setMutedUsers(newMuted);
        localStorage.setItem('mutedUsers', JSON.stringify(newMuted));
    };

    const handleBlockUser = async () => {
        setConfirmDialog({
            isOpen: true,
            title: 'Block User',
            message: 'Are you sure you want to block this user? They will not be able to send you messages.',
            onConfirm: async () => {
                setConfirmDialog({ isOpen: false, title: '', message: '', onConfirm: null });
        try {
            await axios.put(`http://${window.location.hostname}:5000/api/friends/block`, { userId: user.Id, blockId: selectedFriend.Id }, {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            });
            setSelectedFriend(null);
            fetchFriends();
            } catch (err) {
                console.error("Failed to block user", err);
            }
        } });
    };

    const handleDeleteChat = async () => {
        setConfirmDialog({
            isOpen: true,
            title: 'Delete Chat',
            message: 'Are you sure you want to permanently delete all messages with this user? This action cannot be undone.',
            onConfirm: async () => {
                setConfirmDialog({ isOpen: false, title: '', message: '', onConfirm: null });
        try {
            await axios.delete(`http://${window.location.hostname}:5000/api/messages/chat/${selectedFriend.Id}`, {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            });
            setMessages([]);
            } catch (err) {
                console.error("Failed to delete chat", err);
            }
        } });
    };


    const handleLogout = () => {
        socket.disconnect();
        localStorage.removeItem('token');
        delete axios.defaults.headers.common['Authorization'];
        setUser(null);
        navigate('/');
    };

    if (!user) return null;

    const activeFriends = friendsList.filter(f => f.Status === 'accepted');
    const pendingRequests = friendsList.filter(f => f.Status === 'pending' && String(f.AddresseeId) === String(user.Id));

    const renderListPane = () => {
        if (activeTab === 'chats') {
            return (
                <>
                    <div className="chat-list-header" style={{display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '10px'}}>
                        <h2 style={{margin: 0}}>{getText('chatList')}</h2>
                        <button onClick={() => setIsCreateGroupModalOpen(true)} style={{background: 'var(--primary-color)', color: 'white', border: 'none', borderRadius: '50%', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer'}} title="Tạo nhóm mới">
                            <Plus size={20} />
                        </button>
                        <div className="search-bar" style={{width: '100%'}}>
                            <Search size={18} className="search-icon" color="var(--text-secondary)" />
                            <input key="chats-search" type="text" placeholder={getText('search')} />
                        </div>
                    </div>
                    <div className="chat-items">
                        
                        {groups.map(group => (
                            <div
                                key={'g'+group.Id}
                                className={`chat-item ${selectedFriend?.Id == group.Id && selectedFriend?.IsGroup ? 'active' : ''}`}
                                onClick={() => handleSelectFriend({...group, IsGroup: true, Username: group.Name, FullName: group.Name})}
                            >
                                <div className="chat-avatar" style={{background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', overflow: 'hidden'}}>
                                    {group.AvatarUrl ? <img src={`http://${window.location.hostname}:5000${group.AvatarUrl}`} alt="Avatar" style={{width: '100%', height: '100%', objectFit: 'cover'}}/> : <Users size={24} />}
                                    <div className="chat-status-dot" style={{ backgroundColor: '#22c55e' }}></div>
                                </div>
                                <div className="chat-item-info">
                                    <div className="chat-item-top">
                                        <span className="chat-item-name" style={{fontWeight: 'bold'}}>{group.Name} (Group)</span>
                                    </div>
                                </div>
                            </div>
                        ))}
                        {activeFriends.length === 0 && groups.length === 0 ? (
                            <div style={{color: 'var(--text-secondary)', padding: '16px'}}>{getText('homeDesc')}</div>
                        ) : (
                            activeFriends.map(friend => (
                                <div 
                                    key={friend.Id} 
                                    className={`chat-item ${selectedFriend?.Id == friend.Id && !selectedFriend?.IsGroup ? 'active' : ''}`}
                                    onClick={() => handleSelectFriend(friend)}
                                >
                                    <div style={{position: 'relative'}}>
                                        <div className="chat-avatar" style={{background: 'var(--primary-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', overflow: 'hidden'}}>
                                            {friend.AvatarUrl ? <img src={`http://${window.location.hostname}:5000${friend.AvatarUrl}`} alt="Avatar" style={{width: '100%', height: '100%', objectFit: 'cover'}}/> : <UserIcon size={24} />}
                                        </div>
                                        <div className="chat-status-dot" style={{ backgroundColor: onlineUsers.has(friend.Id) ? '#22c55e' : '#6b7280' }}></div>
                                    </div>
                                    <div className="chat-item-info">
                                        <div className="chat-item-top">
                                            <span className="chat-item-name">{friend.FullName || friend.Username}</span>
                                        </div>
                                    </div>
                                    {unreadCounts[friend.Id] > 0 && (
                                        <div className="unread-badge">{unreadCounts[friend.Id]}</div>
                                    )}
                                </div>
                            ))
                        )}
                    </div>
                </>
            );
        }
        
        if (activeTab === 'people') {
            return (
                <>
                    <div className="chat-list-header">
                        <h2>{getText('people')}</h2>
                        <div className="search-bar">
                            <Search size={18} className="search-icon" color="var(--text-secondary)" />
                            <input 
                                key="people-search"
                                type="text" 
                                placeholder={getText('search')} 
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                            />
                        </div>
                    </div>
                    <div className="chat-items">
                        {pendingRequests.length > 0 && (
                            <div style={{marginBottom: '16px'}}>
                                <h3 style={{fontSize: '12px', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '8px'}}>Requests</h3>
                                {pendingRequests.map(req => (
                                    <div key={req.Id} className="chat-item">
                                        <div className="chat-avatar" style={{background: 'var(--primary-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', overflow: 'hidden'}}>
                                            {req.AvatarUrl ? <img src={`http://${window.location.hostname}:5000${req.AvatarUrl}`} alt="Avatar" style={{width: '100%', height: '100%', objectFit: 'cover'}}/> : <UserIcon size={24} />}
                                        </div>
                                        <div className="chat-item-info">
                                            <span className="chat-item-name">{req.FullName || req.Username}</span>
                                        </div>
                                        <button onClick={() => acceptFriendRequest(req.RequesterId)} style={{background: 'var(--primary-color)', color: 'white', border: 'none', borderRadius: '8px', padding: '6px 12px', cursor: 'pointer'}}>
                                            Accept
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}

                        <div>
                            {searchResults.length === 0 && searchQuery ? (
                                <div style={{color: 'var(--text-secondary)', padding: '8px'}}>No users found</div>
                            ) : (
                                searchResults.map(su => (
                                    <div key={su.Id} className="chat-item">
                                        <div className="chat-avatar" style={{background: 'var(--primary-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', overflow: 'hidden'}}>
                                            {su.AvatarUrl ? <img src={`http://${window.location.hostname}:5000${su.AvatarUrl}`} alt="Avatar" style={{width: '100%', height: '100%', objectFit: 'cover'}}/> : <UserIcon size={24} />}
                                        </div>
                                        <div className="chat-item-info">
                                            <span className="chat-item-name">{su.FullName || su.Username}</span>
                                        </div>
                                        {su.Status === 'accepted' ? (
                                            <span style={{fontSize: '12px', color: 'var(--primary-color)'}}>Friend</span>
                                        ) : su.Status === 'pending' ? (
                                            <span style={{fontSize: '12px', color: 'var(--text-secondary)'}}>Pending</span>
                                        ) : (
                                            <button onClick={() => sendFriendRequest(su.Id)} style={{background: 'rgba(255,255,255,0.1)', border: '1px solid var(--glass-border)', borderRadius: '8px', padding: '6px 12px', cursor: 'pointer', color: 'var(--text-primary)'}}>
                                                Add
                                            </button>
                                        )}
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </>
            );
        }

        if (activeTab === 'profile') {
            return (
                <>
                    <div className="chat-list-header" style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                        <h2>{getText('profile') || 'Profile'}</h2>
                        <button className="btn-edit-profile" onClick={() => { setEditProfileData({ FullName: user.FullName || '', Bio: user.Bio || '' }); setIsEditingProfile(true); }} style={{background: 'rgba(255,255,255,0.1)', border: 'none', color: 'var(--text-primary)', padding: '6px 12px', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px'}}>
                            <Edit2 size={14} /> Edit Profile
                        </button>
                    </div>
                    <div className="profile-container" style={{padding: '20px 0'}}>
                        <div className="profile-avatar-wrapper" style={{marginBottom: '16px'}}>
                            {user.AvatarUrl ? (
                                <img src={`http://${window.location.hostname}:5000${user.AvatarUrl}`} alt="Avatar" className="profile-avatar" />
                            ) : (
                                <div className="profile-avatar-placeholder">
                                    <UserIcon size={64} />
                                </div>
                            )}
                            <label className="upload-btn" title="Upload new avatar">
                                <Camera size={18} />
                                <input type="file" style={{display: 'none'}} accept="image/*" onChange={handleAvatarUpload} />
                            </label>
                        </div>
                        <h3 style={{fontSize: '20px', margin: '0 0 4px 0', color: 'var(--text-primary)'}}>{user.FullName || user.Username}</h3>
                        <div style={{display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '16px'}}>
                            <div className="chat-status-dot" style={{position: 'relative', bottom: 0, right: 0, border: 'none', background: '#22c55e'}}></div>
                            Online
                        </div>
                        
                        <div className="profile-info">
                            <div className="profile-info-item">
                                <label>Bio</label>
                                <p style={{fontStyle: user.Bio ? 'normal' : 'italic', color: user.Bio ? 'var(--text-primary)' : 'var(--text-secondary)'}}>{user.Bio || 'No bio provided'}</p>
                            </div>
                            <div className="profile-info-item">
                                <label>Username</label>
                                <p>{user.Username}</p>
                            </div>
                            <div className="profile-info-item">
                                <label>Email</label>
                                <p>{user.Email || 'Not set'}</p>
                            </div>
                        </div>
                    </div>
                </>
            );
        }

        if (activeTab === 'settings') {
            return (
                <>
                    <div className="chat-list-header">
                        <h2>{getText('settings')}</h2>
                    </div>
                    <div className="chat-items" style={{padding: '0 8px'}}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '16px', background: 'rgba(255,255,255,0.05)', borderRadius: '12px', color: 'var(--text-primary)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <span style={{fontWeight: '500'}}>{getText('darkMode')}</span>
                                <label className="toggle-switch">
                                    <input type="checkbox" checked={isDarkMode} onChange={(e) => setIsDarkMode(e.target.checked)} />
                                    <span className="slider"></span>
                                </label>
                            </div>
                            
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <span style={{fontWeight: '500'}}>{getText('soundNotif')}</span>
                                <label className="toggle-switch">
                                    <input type="checkbox" checked={soundEnabled} onChange={(e) => setSoundEnabled(e.target.checked)} />
                                    <span className="slider"></span>
                                </label>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <span style={{fontWeight: '500'}}>{getText('showOnline')}</span>
                                <label className="toggle-switch">
                                    <input type="checkbox" checked={showStatus} onChange={(e) => setShowStatus(e.target.checked)} />
                                    <span className="slider"></span>
                                </label>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'relative' }}>
                                <span style={{fontWeight: '500'}}>{getText('lang')}</span>
                                <div style={{ position: 'relative' }}>
                                    <div 
                                        onClick={() => setIsLangDropdownOpen(!isLangDropdownOpen)}
                                        style={{ padding: '8px 12px', borderRadius: '8px', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--glass-border)', color: 'var(--text-primary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', minWidth: '120px', justifyContent: 'space-between' }}
                                    >
                                        <span>{language}</span>
                                        <ChevronDown size={16} />
                                    </div>
                                    {isLangDropdownOpen && (
                                        <div style={{ position: 'absolute', top: '100%', right: 0, marginTop: '4px', background: 'var(--bg-color)', border: '1px solid var(--glass-border)', borderRadius: '8px', overflow: 'hidden', zIndex: 10, minWidth: '120px', boxShadow: '0 4px 12px rgba(0,0,0,0.2)' }}>
                                            {['English', 'Vietnamese', 'Japanese'].map(lang => (
                                                <div 
                                                    key={lang}
                                                    onClick={() => { setLanguage(lang); setIsLangDropdownOpen(false); }}
                                                    style={{ padding: '10px 16px', cursor: 'pointer', background: language === lang ? 'var(--primary-color)' : 'transparent', color: language === lang ? 'white' : 'var(--text-primary)', fontSize: '14px' }}
                                                    onMouseEnter={(e) => { if (language !== lang) e.target.style.background = 'rgba(255,255,255,0.05)' }}
                                                    onMouseLeave={(e) => { if (language !== lang) e.target.style.background = 'transparent' }}
                                                >
                                                    {lang}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                        
                        <button className="btn-primary" style={{width: '100%', marginTop: '16px', color: 'white', border: 'none', padding: '12px', borderRadius: '12px', cursor: 'pointer', fontWeight: 'bold'}} onClick={() => setShowPasswordModal(true)}>{getText('changePwd')}</button>

                        <button className="btn-primary" style={{width: '100%', backgroundColor: '#ef4444', marginTop: '16px', color: 'white', border: 'none', padding: '12px', borderRadius: '12px', cursor: 'pointer', fontWeight: 'bold'}} onClick={handleLogout}>{getText('logOut')}</button>
                    </div>
                </>
            );
        }

        if (activeTab === 'home') {
            return (
                <>
                    <div className="chat-list-header">
                        <h2>{getText('home')}</h2>
                    </div>
                    <div className="chat-items" style={{padding: '16px', color: 'var(--text-secondary)'}}>
                        <p>{getText('welcome')}</p>
                        <p style={{marginTop: '8px'}}>{getText('homeDesc')}</p>
                    </div>
                </>
            );
        }

        return null;
    };

    return (
        <div className="app-container">
            <div className="main-layout">
                {/* COLUMN 1: SIDEBAR NAV */}
                <nav className="sidebar-nav">
                    <div className="nav-avatar" style={{background: 'var(--primary-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', overflow: 'hidden', cursor: 'pointer'}} onClick={() => setActiveTab('profile')}>
                        {user.AvatarUrl ? <img src={`http://${window.location.hostname}:5000${user.AvatarUrl}`} alt="Avatar" style={{width: '100%', height: '100%', objectFit: 'cover'}}/> : <UserIcon size={24} />}
                        <div className="nav-status-dot"></div>
                    </div>
                    <div className="nav-items">
                        <button className={`nav-item ${activeTab === 'home' ? 'active' : ''}`} onClick={() => setActiveTab('home')} title={getText('home')}>
                            <Home size={24} />
                        </button>
                        <button className={`nav-item ${activeTab === 'chats' ? 'active' : ''}`} onClick={() => setActiveTab('chats')} title={getText('chats')}>
                            <MessageSquare size={24} />
                        </button>
                        <button className={`nav-item ${activeTab === 'people' ? 'active' : ''}`} onClick={() => setActiveTab('people')} title={getText('people')}>
                            <Users size={24} />
                        </button>
                    </div>
                    <div className="nav-bottom">
                        <button className={`nav-item ${activeTab === 'settings' ? 'active' : ''}`} onClick={() => setActiveTab('settings')} title={getText('settings')}>
                            <Settings size={24} />
                        </button>
                        <button className="nav-item" onClick={handleLogout} title={getText('logOut')}>
                            <LogOut size={24} />
                        </button>
                    </div>
                </nav>

                {/* COLUMN 2: CHAT LIST */}
                <aside className="chat-list-pane">
                    {renderListPane()}
                </aside>

                {/* COLUMN 3: MAIN CHAT */}
                <main className="main-chat-pane">
                    {activeTab === 'chats' && selectedFriend ? (
                        <>
                            <header className="main-chat-header">
                                <div className="header-user-info">
                                    <div className="chat-avatar" style={{background: 'var(--primary-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', overflow: 'hidden'}}>
                                        {selectedFriend.AvatarUrl ? <img src={`http://${window.location.hostname}:5000${selectedFriend.AvatarUrl}`} alt="Avatar" style={{width: '100%', height: '100%', objectFit: 'cover'}}/> : <UserIcon size={24} />}
                                    </div>
                                    <div className="header-user-text">
                                        <h3>{selectedFriend.FullName || selectedFriend.Username}</h3>
                                        <div className="header-user-status">
                                            <div className="chat-status-dot" style={{ backgroundColor: onlineUsers.has(selectedFriend.Id) ? '#22c55e' : '#6b7280', position: 'relative', border: 'none', width: '10px', height: '10px', marginRight: '6px' }}></div> 
                                            {onlineUsers.has(selectedFriend.Id) ? getText('online') : getText('offline')} 
                                            {isTyping && <span style={{marginLeft: '4px', fontStyle: 'italic', color: 'var(--primary-color)'}}>- {getText('typing')}...</span>}
                                        </div>
                                    </div>
                                </div>
                                <div className="header-actions">
                                    {!selectedFriend.IsGroup && (
                                        <>
                                            <MonitorUp size={20} style={{cursor: 'pointer', marginRight: '12px', color: 'var(--text-secondary)'}} title={getText('shareScreen')} onClick={() => initiateCall('screen')} />
                                            <Video size={20} style={{cursor: 'pointer', marginRight: '12px', color: 'var(--text-secondary)'}} title={getText('videoCall')} onClick={() => initiateCall('video')} />
                                            <Phone size={20} style={{cursor: 'pointer', marginRight: '12px', color: 'var(--text-secondary)'}} title={getText('audioCall')} onClick={() => initiateCall('audio')} />
                                        </>
                                    )}
                                </div>
                            </header>

                            <div className="messages-area" ref={messagesAreaRef} onScroll={handleScroll}>
                                {isLoadingMore && (
                                    <div style={{textAlign: 'center', padding: '10px', color: 'var(--text-secondary)', fontSize: '12px'}}>
                                        Loading older messages...
                                    </div>
                                )}
                                {messages.length === 0 ? (
                                    <div style={{height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)'}}>
                                        <p>{getText('noMessages')}</p>
                                    </div>
                                ) : (
                                    messages.filter(msg => !searchMessageTerm || msg.Content.toLowerCase().includes(searchMessageTerm.toLowerCase())).map((msg, index) => {
                                        const isMine = msg.SenderId == user.Id;
                                        return (
                                            <div key={msg.Id || index} className={`message-wrapper ${isMine ? 'mine' : 'other'}`}>
                                                <div className="message-meta" style={{flexDirection: isMine ? 'row-reverse' : 'row'}}>
                                                    <div className="chat-avatar" style={{width: '24px', height: '24px', background: 'var(--primary-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', margin: 0, overflow: 'hidden'}}>
                                                        {isMine && user.AvatarUrl ? (
                                                            <img src={`http://${window.location.hostname}:5000${user.AvatarUrl}`} alt="Avatar" style={{width: '100%', height: '100%', objectFit: 'cover'}}/>
                                                        ) : (!isMine && msg.AvatarUrl) ? (
                                                            <img src={`http://${window.location.hostname}:5000${msg.AvatarUrl}`} alt="Avatar" style={{width: '100%', height: '100%', objectFit: 'cover'}}/>
                                                        ) : (!isMine && selectedFriend && !selectedFriend.IsGroup && selectedFriend.AvatarUrl) ? (
                                                            <img src={`http://${window.location.hostname}:5000${selectedFriend.AvatarUrl}`} alt="Avatar" style={{width: '100%', height: '100%', objectFit: 'cover'}}/>
                                                        ) : (
                                                            <UserIcon size={12} />
                                                        )}
                                                    </div>
                                                    <span>{isMine ? getText('you') : (msg.FullName || msg.Username || selectedFriend.FullName || selectedFriend.Username)}</span>
                                                    <span style={{fontSize: '11px'}}>{new Date(msg.CreatedAt || Date.now()).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                                                </div>
                                                <div className="message-content-wrapper" style={{display: 'flex', flexDirection: 'column', alignItems: isMine ? 'flex-end' : 'flex-start'}}>
                                                    {msg.ReplyToMessageId && (() => {
                                                        const repliedMsg = messages.find(m => m.Id == msg.ReplyToMessageId);
                                                        if (repliedMsg) {
                                                            return (
                                                                <div style={{fontSize: '12px', color: 'var(--text-secondary)', background: 'var(--bg-secondary)', padding: '4px 8px', borderRadius: '4px', marginBottom: '4px', maxWidth: '100%', opacity: 0.8, borderLeft: `3px solid var(--primary-color)`}}>
                                                                    <strong>{repliedMsg.Username || repliedMsg.FullName}:</strong> {repliedMsg.Content ? (repliedMsg.Content.length > 30 ? repliedMsg.Content.substring(0, 30) + '...' : repliedMsg.Content) : 'Media'}
                                                                </div>
                                                            );
                                                        }
                                                        return null;
                                                    })()}
                                                    <div style={{display: 'flex', flexDirection: isMine ? 'row-reverse' : 'row', alignItems: 'center'}}>
                                                        <div className="message-bubble">
                                                            {msg.ImageUrl ? (
                                                                <div>
                                                                    
                                                                    {msg.Content !== 'Sent an image' && msg.Content !== '' && (
                                                                        <div style={{marginBottom: '8px'}}>
                                                                            {msg.Content}
                                                                            {msg.Content.match(/https?:\/\/[^\s]+/) && (
                                                                                <LinkPreview url={msg.Content.match(/https?:\/\/[^\s]+/)[0]} />
                                                                            )}
                                                                        </div>
                                                                    )}

                                                                    <img src={msg.ImageUrl.startsWith('http') ? msg.ImageUrl : `http://${window.location.hostname}:5000${msg.ImageUrl}`} alt="attachment" className="chat-image" />
                                                                </div>
                                                            ) : msg.AttachmentUrl ? (
                                                                <div>
                                                                    {msg.Content && <div style={{marginBottom: '8px'}}>{msg.Content}</div>}
                                                                    {msg.AttachmentUrl.endsWith('.webm') ? (
                                                                        <audio controls src={msg.AttachmentUrl.startsWith('http') ? msg.AttachmentUrl : `http://${window.location.hostname}:5000${msg.AttachmentUrl}`} style={{maxWidth: '200px'}} />
                                                                    ) : (
                                                                        <div style={{display: 'flex', alignItems: 'center', background: 'rgba(0,0,0,0.1)', padding: '8px', borderRadius: '8px'}}>
                                                                            <Folder size={20} style={{marginRight: '8px', color: 'var(--primary-color)'}} />
                                                                            <a href={`http://${window.location.hostname}:5000${msg.AttachmentUrl}`} target="_blank" rel="noopener noreferrer" style={{color: 'var(--primary-color)', textDecoration: 'none'}}>{getText('downloadFile')}</a>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            ) : (
                                                                msg.Content
                                                            )}
                                                        </div>
                                                        <div className="message-actions" style={{display: 'flex', gap: '8px', padding: '0 8px'}}>
                                                            <span style={{cursor: 'pointer', fontSize: '14px'}} onClick={() => setReplyingTo(msg)} title="Reply">↩️</span>
                                                            <span style={{cursor: 'pointer', fontSize: '14px'}} onClick={() => handleReact(msg.Id, '❤️')} title="Love">❤️</span>
                                                            <span style={{cursor: 'pointer', fontSize: '14px'}} onClick={() => handleReact(msg.Id, '👍')} title="Like">👍</span>
                                                            <span style={{cursor: 'pointer', fontSize: '14px'}} onClick={() => handleReact(msg.Id, '😂')} title="Haha">😂</span>
                                                        </div>
                                                    </div>
                                                    {msg.Reactions && msg.Reactions.length > 0 && (
                                                        <div style={{display: 'flex', gap: '4px', marginTop: '4px', background: 'var(--bg-secondary)', padding: '2px 8px', borderRadius: '12px', fontSize: '12px', border: '1px solid var(--border-color)', alignSelf: isMine ? 'flex-end' : 'flex-start'}}>
                                                            {msg.Reactions.map((r, i) => (
                                                                <span key={i} title={r.Username} style={{cursor: 'pointer'}} onClick={() => handleReact(msg.Id, r.Reaction)}>{r.Reaction}</span>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                                {isMine && (
                                                    <div className="message-status">
                                                        <CheckCheck size={14} /> {getText('read')}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })
                                )}
                                <div ref={messagesEndRef} />
                            </div>

                            <div className="input-area-container">
                                
        {replyingTo && (
            <div style={{ padding: '8px 16px', background: 'rgba(255,255,255,0.05)', borderTop: '1px solid var(--glass-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <span style={{ fontSize: '12px', color: 'var(--primary-color)', fontWeight: 'bold' }}>Replying to {replyingTo.Username}</span>
                    <p style={{ fontSize: '14px', margin: 0, color: 'var(--text-secondary)' }}>{replyingTo.Content.substring(0, 50)}...</p>
                </div>
                <button onClick={() => setReplyingTo(null)} style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>✖</button>
            </div>
        )}
        <form className="input-box" onSubmit={handleSendMessage}>


                                    <div className="input-main" style={{position: 'relative'}}>
                                        {showEmojiPicker && (
                                            <div style={{position: 'absolute', bottom: '100%', left: '0', zIndex: 100, marginBottom: '10px'}}>
                                                <EmojiPicker onEmojiClick={(emojiData) => setNewMessage(prev => prev + emojiData.emoji)} theme={isDarkMode ? 'dark' : 'light'} />
                                            </div>
                                        )}
                                        {showStickerPicker && (
                                            <div style={{position: 'absolute', bottom: '100%', left: '30px', zIndex: 100, marginBottom: '10px', background: 'var(--glass-bg)', padding: '10px', borderRadius: '8px', display: 'flex', gap: '8px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)'}}>
                                                {STICKERS.map((s, i) => (
                                                    <img key={i} src={s} alt="Sticker" style={{width: '60px', height: '60px', cursor: 'pointer', borderRadius: '4px'}} onClick={() => sendSticker(s)} />
                                                ))}
                                            </div>
                                        )}
                                        <Smile size={20} style={{color: 'var(--text-secondary)', marginRight: '8px', cursor: 'pointer'}} onClick={() => {setShowEmojiPicker(!showEmojiPicker); setShowStickerPicker(false);}} />
                                        <Sticker size={20} style={{color: 'var(--text-secondary)', marginRight: '12px', cursor: 'pointer'}} onClick={() => {setShowStickerPicker(!showStickerPicker); setShowEmojiPicker(false);}} />
                                        <input
                                            type="text"
                                            placeholder={getText('typeMessage')}
                                            value={newMessage}
                                            onChange={handleMessageChange}
                                        />
                                        <div className="input-actions">
                                            <label style={{cursor: 'pointer', display: 'flex', alignItems: 'center'}} title={getText('attachImage')}>
                                                <Paperclip size={20} />
                                                <input type="file" style={{display: 'none'}} accept="image/*" onChange={handleImageUpload} />
                                            </label>
                                            <label style={{cursor: 'pointer', display: 'flex', alignItems: 'center'}} title={getText('attachDoc')}>
                                                <Folder size={20} />
                                                <input type="file" style={{display: 'none'}} accept=".pdf,.doc,.docx,.xls,.xlsx,.zip,.txt" onChange={handleDocumentUpload} />
                                            </label>
                                            <Mic size={20} style={{cursor: 'pointer', color: isRecording ? '#ef4444' : 'var(--text-secondary)'}} onClick={handleVoiceRecord} title={getText('record')} />
                                            <button type="submit" className="btn-send" disabled={!newMessage.trim()}>
                                                <span style={{fontWeight: 'bold', fontSize: '14px'}}>{getText('send')}</span>
                                            </button>
                                        </div>
                                    </div>
                                </form>
                            </div>
                        </>
                    ) : (
                        <div style={{height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)'}}>
                            {activeTab === 'home' ? (
                                <>
                                    <Home size={64} style={{marginBottom: '16px', opacity: 0.5}} />
                                    <h2>{getText('welcome')}</h2>
                                    <p>{getText('dashboardEmpty')}</p>
                                </>
                            ) : (
                                <>
                                    <MessageSquare size={64} style={{marginBottom: '16px', opacity: 0.5}} />
                                    <h2>Select a chat</h2>
                                    <p>Choose a friend from the left panel to start messaging.</p>
                                </>
                            )}
                        </div>
                    )}
                </main>

                {/* COLUMN 4: CONVERSATION DETAILS PANE */}
                {selectedFriend && activeTab !== 'profile' && (
                    <aside className="conversation-details-pane">
                        <div className="details-header">
                            <h3>{getText("conversation")}</h3>
                        </div>
                        <div className="details-profile">
                            <div className="chat-avatar" style={{width: '80px', height: '80px', margin: '0 auto 16px', background: 'var(--primary-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', color: 'white', position: 'relative'}}>
                                {selectedFriend.AvatarUrl ? <img src={`http://${window.location.hostname}:5000${selectedFriend.AvatarUrl}`} alt="Avatar" style={{width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%'}}/> : <UserIcon size={40} />}
                            </div>
                            <h3 style={{margin: '0 0 8px', fontSize: '18px'}}>{selectedFriend.FullName || selectedFriend.Username}</h3>
                            <div style={{display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '16px'}}>
                                <div className="chat-status-dot" style={{position: 'relative', bottom: 0, right: 0, border: 'none', background: onlineUsers.has(selectedFriend.Id) ? '#22c55e' : '#94a3b8', width: '10px', height: '10px'}}></div>
                                {onlineUsers.has(selectedFriend.Id) ? 'Online' : 'Offline'}
                            </div>
                            <p style={{color: 'var(--text-primary)', fontSize: '14px', fontStyle: 'italic', margin: '0 0 24px', padding: '0 24px', textAlign: 'center'}}>
                                {selectedFriend.Bio || 'Software Engineer Student'}
                            </p>
                        </div>

                        {!selectedFriend.IsGroup && (
                            <div className="details-actions-row">
                                <div className="details-action-btn" onClick={() => initiateCall('audio')}>
                                    <Phone size={20} />
                                    <span>{getText("audioCall")}</span>
                                </div>
                                <div className="details-action-btn" onClick={() => initiateCall('video')}>
                                    <Video size={20} />
                                    <span>{getText("videoCall")}</span>
                                </div>
                            </div>
                        )}

                        <div className="details-section">
                            <div className="details-menu-item" onClick={handleMuteUser}>
                                <BellOff size={18} /> <span>{mutedUsers.includes(selectedFriend.Id) ? 'Unmute Notification' : 'Mute Notification'}</span>
                            </div>
                            <div className="details-menu-item" style={{color: '#ef4444'}} onClick={handleBlockUser}>
                                <Ban size={18} /> <span>{getText("blockUser")}</span>
                            </div>
                            <div className="details-menu-item" style={{color: '#ef4444'}} onClick={handleDeleteChat}>
                                <Trash2 size={18} /> <span>{getText("deleteChat")}</span>
                            </div>
                        </div>

                        <div className="details-section">
                            <h4 className="details-section-title">Search Messages</h4>
                            <div className="search-bar" style={{margin: 0}}>
                                <Search size={16} className="search-icon" color="var(--text-secondary)" />
                                <input type="text" placeholder={getText("searchDots")} value={searchMessageTerm} onChange={e => setSearchMessageTerm(e.target.value)} />
                            </div>
                        </div>

                        <div className="details-section">
                            <div className="details-section-header">
                                <h4>Shared Media</h4>
                                <span>{getText("viewAll")} <ChevronRight size={14} /></span>
                            </div>
                            <div className="shared-media-grid">
                                {messages.filter(m => m.ImageUrl).slice(-6).map((m, i) => (
                                    <div key={i} className="media-item" style={{ overflow: 'hidden', padding: 0 }}>
                                        <img src={m.ImageUrl.startsWith('http') ? m.ImageUrl : `http://${window.location.hostname}:5000${m.ImageUrl}`} alt="media" style={{width: '100%', height: '100%', objectFit: 'cover'}} />
                                    </div>
                                ))}
                                {messages.filter(m => m.ImageUrl).length === 0 && (
                                    <p style={{fontSize: '12px', color: 'var(--text-secondary)', gridColumn: 'span 3', textAlign: 'center'}}>No media shared</p>
                                )}
                            </div>
                        </div>

                        <div className="details-section">
                            <div className="details-section-header">
                                <h4>Shared Files</h4>
                                <span>View all <ChevronRight size={14} /></span>
                            </div>
                            {messages.filter(m => m.AttachmentUrl && !m.AttachmentUrl.endsWith('.webm')).slice(-3).map((m, i) => (
                                <a key={i} href={m.AttachmentUrl.startsWith('http') ? m.AttachmentUrl : `http://${window.location.hostname}:5000${m.AttachmentUrl}`} target="_blank" rel="noopener noreferrer" style={{textDecoration: 'none', color: 'inherit'}}>
                                    <div className="shared-file-item">
                                        <FileText size={20} color="#3b82f6" />
                                        <div style={{overflow: 'hidden'}}>
                                            <h5 style={{whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden'}}>{m.AttachmentUrl.split('-').pop()}</h5>
                                            <p>File</p>
                                        </div>
                                    </div>
                                </a>
                            ))}
                            {messages.filter(m => m.AttachmentUrl && !m.AttachmentUrl.endsWith('.webm')).length === 0 && (
                                <p style={{fontSize: '12px', color: 'var(--text-secondary)', textAlign: 'center'}}>No files shared</p>
                            )}
                        </div>

                        <div className="details-section">
                            <div className="details-section-header">
                                <h4>Shared Links</h4>
                                <span>View all <ChevronRight size={14} /></span>
                            </div>
                            {messages.map(m => {
                                const urls = m.Content?.match(/https?:\/\/[^\s]+/g);
                                return urls ? urls.map((url, i) => {
                                    let hostname = url;
                                    try { hostname = new URL(url).hostname; } catch(e) {}
                                    return (
                                        <a key={`${m.Id}-${i}`} href={url} target="_blank" rel="noopener noreferrer" style={{textDecoration: 'none', color: 'inherit'}}>
                                            <div className="shared-link-item">
                                                <div className="link-icon"><Link size={16} /></div>
                                                <div style={{overflow: 'hidden'}}>
                                                    <h5 style={{whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden'}}>{hostname}</h5>
                                                    <p style={{whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden'}}>{url}</p>
                                                </div>
                                            </div>
                                        </a>
                                    );
                                }) : null;
                            }).flat().filter(Boolean).slice(-3)}
                            {messages.filter(m => m.Content?.match(/https?:\/\/[^\s]+/g)).length === 0 && (
                                <p style={{fontSize: '12px', color: 'var(--text-secondary)', textAlign: 'center'}}>No links shared</p>
                            )}
                        </div>
                    </aside>
                )}

                {/* MODALS */}
                {incomingCall && !callActive && (
                    <div style={{position: 'fixed', top: '20px', left: '50%', transform: 'translateX(-50%)', background: 'var(--glass-bg)', border: '1px solid var(--glass-border)', padding: '16px 24px', borderRadius: '16px', zIndex: 1000, display: 'flex', alignItems: 'center', gap: '16px', backdropFilter: 'blur(10px)', color: 'white'}}>
                        <div className="chat-avatar" style={{width: '40px', height: '40px', background: 'var(--primary-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%'}}><UserIcon size={20}/></div>
                        <div>
                            <h4 style={{margin: 0}}>{incomingCall.callerName} is calling...</h4>
                        </div>
                        <div style={{display: 'flex', gap: '8px'}}>
                            <button style={{background: '#22c55e', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer'}} onClick={acceptCall}>Accept</button>
                            <button style={{background: '#ef4444', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer'}} onClick={() => { setIncomingCall(null); if(incomingCall.call) incomingCall.call.close(); }}>Decline</button>
                        </div>
                    </div>
                )}
                
                {callActive && (
                    <div style={{position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', background: 'var(--glass-bg)', border: '1px solid var(--glass-border)', padding: '24px', borderRadius: '16px', zIndex: 1000, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', backdropFilter: 'blur(10px)', color: 'white', minWidth: '400px'}}>
                        <h3>Video Call</h3>
                        <div style={{display: 'flex', gap: '16px', width: '100%', justifyContent: 'center'}}>
                            <div style={{position: 'relative', width: '150px', height: '150px', background: 'black', borderRadius: '8px', overflow: 'hidden'}}>
                                <video playsInline muted ref={myVideoRef} autoPlay style={{width: '100%', height: '100%', objectFit: 'cover'}} />
                                <div style={{position: 'absolute', bottom: 4, left: 4, fontSize: '12px', background: 'rgba(0,0,0,0.5)', padding: '2px 4px', borderRadius: '4px'}}>You</div>
                            </div>
                            <div style={{position: 'relative', width: '200px', height: '150px', background: 'black', borderRadius: '8px', overflow: 'hidden'}}>
                                {remoteStream ? (
                                    <video playsInline ref={remoteVideoRef} autoPlay style={{width: '100%', height: '100%', objectFit: 'cover'}} />
                                ) : (
                                    <div style={{display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%'}}>Connecting...</div>
                                )}
                            </div>
                        </div>
                        <button style={{background: '#ef4444', color: 'white', border: 'none', padding: '12px 24px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold'}} onClick={endCall}>End Call</button>
                    </div>
                )}
            </div>

            {/* Password Modal */}
            {showPasswordModal && (
                <div style={{position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
                    <div style={{background: 'var(--bg-color)', padding: '24px', borderRadius: '16px', width: '320px'}}>
                        <h3 style={{marginBottom: '16px', color: 'var(--text-primary)'}}>{getText('changePwd')}</h3>
                        <form onSubmit={handleChangePassword}>
                            <input type="password" placeholder={getText('oldPwd')} required style={{width: '100%', padding: '10px', marginBottom: '12px', borderRadius: '8px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--glass-border)', color: 'var(--text-primary)'}} value={oldPassword} onChange={e => setOldPassword(e.target.value)} />
                            <input type="password" placeholder={getText('newPwd')} required style={{width: '100%', padding: '10px', marginBottom: '12px', borderRadius: '8px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--glass-border)', color: 'var(--text-primary)'}} value={newPassword} onChange={e => setNewPassword(e.target.value)} />
                            <input type="password" placeholder={getText('confirmPwd')} required style={{width: '100%', padding: '10px', marginBottom: '16px', borderRadius: '8px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--glass-border)', color: 'var(--text-primary)'}} value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} />
                            
                            <div style={{display: 'flex', gap: '8px'}}>
                                <button type="submit" style={{flex: 1, padding: '10px', borderRadius: '8px', background: 'var(--primary-color)', color: 'white', border: 'none', cursor: 'pointer', fontWeight: 'bold'}}>{getText('update')}</button>
                                <button type="button" onClick={() => setShowPasswordModal(false)} style={{flex: 1, padding: '10px', borderRadius: '8px', background: 'rgba(255,255,255,0.1)', color: 'var(--text-primary)', border: 'none', cursor: 'pointer', fontWeight: 'bold'}}>{getText('cancel')}</button>
                            </div>
                            {changePasswordMsg && <div style={{marginTop: '12px', fontSize: '13px', color: changePasswordMsg.includes('match') || changePasswordMsg.includes('Error') ? '#ef4444' : '#22c55e', textAlign: 'center'}}>{changePasswordMsg}</div>}
                        </form>
                    </div>
                </div>
            )}

            {/* Edit Profile Modal */}
            {isEditingProfile && (
                <div className="modal-overlay" onClick={() => setIsEditingProfile(false)} style={{position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(5px)'}}>
                    <div className="modal-content" onClick={e => e.stopPropagation()} style={{background: 'var(--glass-bg)', padding: '32px', borderRadius: '24px', width: '400px', border: '1px solid var(--glass-border)', boxShadow: '0 8px 32px rgba(0,0,0,0.2)'}}>
                        <h2 style={{marginTop: 0, marginBottom: '24px', color: 'var(--text-primary)'}}>Edit Profile</h2>
                        
                        <div style={{marginBottom: '16px'}}>
                            <label style={{display: 'block', marginBottom: '8px', color: 'var(--text-secondary)', fontSize: '14px'}}>Full Name</label>
                            <input 
                                type="text" 
                                value={editProfileData.FullName} 
                                onChange={e => setEditProfileData({...editProfileData, FullName: e.target.value})}
                                style={{width: '100%', padding: '12px 16px', borderRadius: '12px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--glass-border)', color: 'var(--text-primary)', outline: 'none'}}
                            />
                        </div>

                        <div style={{marginBottom: '24px'}}>
                            <label style={{display: 'block', marginBottom: '8px', color: 'var(--text-secondary)', fontSize: '14px'}}>Bio</label>
                            <textarea 
                                value={editProfileData.Bio} 
                                onChange={e => setEditProfileData({...editProfileData, Bio: e.target.value})}
                                rows={4}
                                style={{width: '100%', padding: '12px 16px', borderRadius: '12px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--glass-border)', color: 'var(--text-primary)', outline: 'none', resize: 'vertical'}}
                            />
                        </div>

                        <div style={{display: 'flex', gap: '12px', justifyContent: 'flex-end'}}>
                            <button onClick={() => setIsEditingProfile(false)} style={{padding: '10px 20px', borderRadius: '12px', background: 'transparent', border: '1px solid var(--glass-border)', color: 'var(--text-primary)', cursor: 'pointer'}}>Cancel</button>
                            <button onClick={handleSaveProfile} style={{padding: '10px 20px', borderRadius: '12px', background: 'var(--primary-color)', border: 'none', color: 'white', cursor: 'pointer', fontWeight: 'bold'}}>Save</button>
                        </div>
                    </div>
                </div>
            )}

            
            {/* Create Group Modal */}
            {isCreateGroupModalOpen && (
                <div className="modal-overlay" style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: 'rgba(0, 0, 0, 0.6)', backdropFilter: 'blur(4px)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    zIndex: 100000
                }}>
                    <div className="modal-content" style={{
                        background: 'var(--glass-bg)', padding: '32px',
                        borderRadius: '16px', maxWidth: '400px', width: '90%',
                        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)',
                        border: '1px solid var(--glass-border)'
                    }}>
                        <h3 style={{ margin: '0 0 16px', fontSize: '20px', color: 'var(--text-primary)', textAlign: 'center' }}>Create Group</h3>
                        
                        <div style={{marginBottom: '16px'}}>
                            <label style={{display: 'block', marginBottom: '8px', color: 'var(--text-secondary)', fontSize: '14px'}}>Group Name</label>
                            <input 
                                type="text" 
                                value={newGroupName} 
                                onChange={(e) => setNewGroupName(e.target.value)}
                                placeholder="Enter group name"
                                style={{width: '100%', padding: '12px 16px', borderRadius: '12px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--glass-border)', color: 'var(--text-primary)', outline: 'none'}}
                            />
                        </div>

                        <div style={{marginBottom: '24px', maxHeight: '150px', overflowY: 'auto'}}>
                            <label style={{display: 'block', marginBottom: '8px', color: 'var(--text-secondary)', fontSize: '14px'}}>Select Members</label>
                            {friendsList.filter(f => f.Status === 'accepted').map(friend => (
                                <label key={friend.Id} style={{display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', color: 'var(--text-primary)', cursor: 'pointer'}}>
                                    <input 
                                        type="checkbox" 
                                        checked={newGroupMembers.includes(friend.Id)}
                                        onChange={(e) => {
                                            if (e.target.checked) setNewGroupMembers([...newGroupMembers, friend.Id]);
                                            else setNewGroupMembers(newGroupMembers.filter(id => id !== friend.Id));
                                        }}
                                    />
                                    {friend.FullName || friend.Username}
                                </label>
                            ))}
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                            <button onClick={() => setIsCreateGroupModalOpen(false)} style={{padding: '10px 20px', borderRadius: '12px', background: 'transparent', border: '1px solid var(--glass-border)', color: 'var(--text-primary)', cursor: 'pointer', fontWeight: 'bold'}}>Cancel</button>
                            <button onClick={handleCreateGroup} style={{padding: '10px 20px', borderRadius: '12px', background: 'var(--primary-color)', border: 'none', color: 'white', cursor: 'pointer', fontWeight: 'bold'}}>Create</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Custom Confirm Dialog Modal */}
            {confirmDialog.isOpen && (
                <div className="modal-overlay" style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: 'rgba(0, 0, 0, 0.6)', backdropFilter: 'blur(4px)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    zIndex: 100000
                }}>
                    <div className="modal-content" style={{
                        background: 'var(--glass-bg)', padding: '32px',
                        borderRadius: '16px', maxWidth: '400px', width: '90%',
                        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2), 0 10px 10px -5px rgba(0, 0, 0, 0.1)',
                        border: '1px solid var(--glass-border)'
                    }}>
                        <h3 style={{ margin: '0 0 16px', fontSize: '20px', color: 'var(--text-primary)' }}>{confirmDialog.title}</h3>
                        <p style={{ margin: '0 0 24px', fontSize: '15px', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
                            {confirmDialog.message}
                        </p>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                            <button onClick={() => setConfirmDialog({ isOpen: false, title: '', message: '', onConfirm: null })} style={{
                                padding: '10px 20px', borderRadius: '8px', border: '1px solid var(--glass-border)',
                                background: 'transparent', color: 'var(--text-primary)', cursor: 'pointer',
                                fontWeight: '500', fontSize: '14px', transition: 'all 0.2s'
                            }} onMouseOver={e => e.target.style.background = 'rgba(255,255,255,0.05)'} onMouseOut={e => e.target.style.background = 'transparent'}>
                                Cancel
                            </button>
                            <button onClick={confirmDialog.onConfirm} style={{
                                padding: '10px 20px', borderRadius: '8px', border: 'none',
                                background: '#ef4444', color: 'white', cursor: 'pointer',
                                fontWeight: '500', fontSize: '14px', transition: 'all 0.2s',
                                boxShadow: '0 4px 6px rgba(239, 68, 68, 0.2)'
                            }} onMouseOver={e => e.target.style.transform = 'translateY(-1px)'} onMouseOut={e => e.target.style.transform = 'translateY(0)'}>
                                {confirmDialog.title}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Chat;
