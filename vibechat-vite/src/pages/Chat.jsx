import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { socket } from '../socket';
import { 
    LogOut, User as UserIcon, MessageSquare, Users, ArrowLeft,
    Settings, Search, Shield, Accessibility, HelpCircle, AlertTriangle,
    Home, Video, Menu, CheckCheck, Check, Phone, MonitorUp, Paperclip, Folder, Smile, Plus, Bold, Code, List, Camera, Mic, Sticker, ChevronDown, Edit2,
    BellOff, Ban, Trash2, ChevronRight, FileText, Link, Image as ImageIcon,
    Bell, Moon, Circle, X, UserCheck, Archive, MoreHorizontal, Info, Reply, MoreVertical
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
    const [editProfileData, setEditProfileData] = useState({ FullName: '', Bio: '', Username: '', Email: '', DateOfBirth: '', Password: '' });
    const [editProfileError, setEditProfileError] = useState('');

    const t = {
        English: { conversation: "Conversation", muteNotif: "Mute Notification", blockUser: "Block User", deleteChat: "Delete Chat", searchMessages: "SEARCH MESSAGES", searchDots: "Search...", sharedMedia: "SHARED MEDIA", viewAll: "View all", settings: "Settings", darkMode: "Dark Mode", soundNotif: "Sound Notifications", showOnline: "Show Online Status", lang: "Language", changePwd: "Change Password", logOut: "Log Out", oldPwd: "Old Password", newPwd: "New Password", confirmPwd: "Confirm New Password", update: "Update", cancel: "Cancel", home: "Home", chats: "Chats", people: "People", chatList: "Chat List", search: "Search", allChats: "All Chats", clickToView: "Click to view messages", selectChat: "Select a chat", selectChatDesc: "Choose a friend from the left panel to start messaging.", typeMessage: "Type a message...", send: "Send", voiceMsg: "Voice message", cancelMsg: "Cancel", sendFile: "Send file", sendVoice: "Send voice message", welcome: "Welcome Home", homeDesc: "Your dashboard is empty right now.", online: "Online", offline: "Offline", typing: "Typing", shareScreen: "Share Screen", videoCall: "Video Call", audioCall: "Audio Call", noMessages: "No messages yet. Say hi!", you: "You", downloadFile: "Download File", read: "Read", attachImage: "Attach Image", attachDoc: "Attach Document", record: "Hold/Click to Record" },
        Vietnamese: { conversation: "Cuộc trò chuyện", muteNotif: "Tắt thông báo", blockUser: "Chặn người dùng", deleteChat: "Xóa cuộc trò chuyện", searchMessages: "TÌM KIẾM TIN NHẮN", searchDots: "Tìm kiếm...", sharedMedia: "FILE PHƯƠNG TIỆN", viewAll: "Xem tất cả", settings: "Cài đặt", darkMode: "Nền tối", soundNotif: "Âm thanh thông báo", showOnline: "Hiển thị Online", lang: "Ngôn ngữ", changePwd: "Đổi mật khẩu", logOut: "Đăng xuất", oldPwd: "Mật khẩu cũ", newPwd: "Mật khẩu mới", confirmPwd: "Xác nhận mật khẩu", update: "Cập nhật", cancel: "Hủy", home: "Trang chủ", chats: "Tin nhắn", people: "Mọi người", chatList: "Danh sách chat", search: "Tìm kiếm", allChats: "Tất cả tin nhắn", clickToView: "Bấm để xem tin nhắn", selectChat: "Chọn một đoạn chat", selectChatDesc: "Chọn một người bạn ở danh sách bên trái để bắt đầu trò chuyện.", typeMessage: "Nhập tin nhắn...", send: "Gửi", voiceMsg: "Tin nhắn thoại", cancelMsg: "Hủy", sendFile: "Gửi file", sendVoice: "Gửi tin nhắn thoại", welcome: "Chào mừng bạn", homeDesc: "Bảng điều khiển của bạn hiện đang trống.", online: "Trực tuyến", offline: "Ngoại tuyến", typing: "Đang gõ", shareScreen: "Chia sẻ màn hình", videoCall: "Gọi Video", audioCall: "Gọi thoại", noMessages: "Chưa có tin nhắn nào. Hãy gửi lời chào!", you: "Bạn", downloadFile: "Tải file", read: "Đã xem", attachImage: "Gửi ảnh", attachDoc: "Gửi tài liệu", record: "Nhấn/Giữ để Thu âm" },
        Japanese: { conversation: "会話", muteNotif: "通知をミュート", blockUser: "ユーザーをブロック", deleteChat: "チャットを削除", searchMessages: "メッセージを検索", searchDots: "検索...", sharedMedia: "共有メディア", viewAll: "すべて見る", settings: "設定", darkMode: "ダークモード", soundNotif: "通知音", showOnline: "オンライン表示", lang: "言語", changePwd: "パスワード変更", logOut: "ログアウト", oldPwd: "現在のパスワード", newPwd: "新しいパスワード", confirmPwd: "パスワードの確認", update: "更新", cancel: "キャンセル", home: "ホーム", chats: "チャット", people: "人々", chatList: "チャットリスト", search: "検索", allChats: "すべてのチャット", clickToView: "クリックしてメッセージを表示", selectChat: "チャットを選択", selectChatDesc: "左側のパネルから友達を選んでメッセージを開始します。", typeMessage: "メッセージを入力...", send: "送信", voiceMsg: "ボイスメッセージ", cancelMsg: "キャンセル", sendFile: "ファイルを送信", sendVoice: "ボイスメッセージを送信", welcome: "ようこそ", homeDesc: "ダッシュボードは現在空です。", online: "オンライン", offline: "オフライン", typing: "入力中", shareScreen: "画面共有", videoCall: "ビデオ通話", audioCall: "音声通話", noMessages: "メッセージはまだありません。挨拶しましょう！", you: "あなた", downloadFile: "ファイルをダウンロード", read: "既読", attachImage: "画像を添付", attachDoc: "ドキュメントを添付", record: "録音する" }
    };
    const getText = (key) => t[language]?.[key] || t['English'][key];
    const [isRecording, setIsRecording] = useState(false);
    const [showStickerPicker, setShowStickerPicker] = useState(false);



    const [replyingTo, setReplyingTo] = useState(null);
    const [hoveredMessageId, setHoveredMessageId] = useState(null);
    const [activeDropdownId, setActiveDropdownId] = useState(null);
    const [activeReactionBarId, setActiveReactionBarId] = useState(null);
    const [hasMore, setHasMore] = useState(true);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const messagesAreaRef = useRef(null);



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
    const [peopleSubTab, setPeopleSubTab] = useState('friends');

    // WebRTC State
    const [peer, setPeer] = useState(null);
    const [myStream, setMyStream] = useState(null);
    const [remoteStream, setRemoteStream] = useState(null);
    const [callActive, setCallActive] = useState(false);
    const [callIsVideo, setCallIsVideo] = useState(true);
    
    // Change password state
    const [oldPassword, setOldPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [changePasswordMsg, setChangePasswordMsg] = useState('');
    const [showPasswordModal, setShowPasswordModal] = useState(false);
    
    const [showProfileMenu, setShowProfileMenu] = useState(false);
    const [showSettingsModal, setShowSettingsModal] = useState(false);
    const [showPolicyModal, setShowPolicyModal] = useState(false);
    const [showBlockedModal, setShowBlockedModal] = useState(false);
    const [showFriendProfileModal, setShowFriendProfileModal] = useState(false);
    const [showSearchMessages, setShowSearchMessages] = useState(false);
    const [showNicknameModal, setShowNicknameModal] = useState(false);
    const [nickname, setNickname] = useState('');
    const [showAccountDetails, setShowAccountDetails] = useState(false);
    const [policyType, setPolicyType] = useState('');
    const profileMenuRef = useRef(null);
    
    const messagesEndRef = useRef(null);
    const typingTimeoutRef = useRef(null);
    const myVideoRef = useRef(null);
    const remoteVideoRef = useRef(null);
    const currentCallRef = useRef(null);
    const callStartTimeRef = useRef(null);
    const isCallerRef = useRef(false);
    const callTimeoutRef = useRef(null);
    const navigate = useNavigate();

    useEffect(() => {
        function handleClickOutside(event) {
            if (profileMenuRef.current && !profileMenuRef.current.contains(event.target)) {
                setShowProfileMenu(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

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
            const response = await axios.get(`/api/friends/${user.Id}`);
            setFriendsList(response.data);
        } catch (err) {
            console.error("Failed to fetch friends", err);
        }
    }, [user]);

    const fetchTasks = useCallback(async () => {
        if (!user) return;
        try {
            const response = await axios.get(`/api/tasks`);
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

    // Auto-select first chat for desktop users
    useEffect(() => {
        const activeFriends = friendsList.filter(f => f.Status === 'accepted' && f.IsArchived !== 1);
        if (activeTab === 'chats' && activeFriends.length > 0 && !selectedFriend && window.innerWidth > 768) {
            handleSelectFriend(activeFriends[0]);
        }
    }, [friendsList, activeTab, selectedFriend]);

    // Handle search users
    useEffect(() => {
        if (activeTab === 'people') {
            const delayDebounceFn = setTimeout(async () => {
                try {
                    const response = await axios.get(`/api/users/search?q=${searchQuery.trim()}&currentUserId=${user.Id}`);
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
            await axios.post(`/api/friends/request`, {
                requesterId: user.Id,
                addresseeId
            });
            setSearchResults(prev => prev.map(u => u.Id === addresseeId ? { ...u, Status: 'pending', RequesterId: user.Id } : u));
            fetchFriends(); // Fetch to update friendsList too
        } catch (err) {
            console.error(err);
        }
    };

    const acceptFriendRequest = async (requesterId) => {
        try {
            await axios.post(`/api/friends/accept`, {
                requesterId,
                addresseeId: user.Id
            });
            fetchFriends();
            setSearchResults(prev => prev.map(u => u.Id === requesterId ? { ...u, Status: 'accepted' } : u));
        } catch (err) {
            console.error(err);
        }
    };

    const unfriendUser = async (friendId) => {
        try {
            await axios.delete(`/api/friends/${friendId}`);
            fetchFriends();
            setSearchResults(prev => prev.map(u => u.Id === friendId ? { ...u, Status: null } : u));
            if (selectedFriend && selectedFriend.Id === friendId) {
                setSelectedFriend(null);
            }
        } catch (err) {
            console.error('Error removing friend:', err);
        }
    };
    
    const blockUser = async (blockId) => {
        try {
            await axios.put(`/api/friends/block`, { userId: user.Id, blockId });
            fetchFriends();
            setSearchResults(prev => prev.map(u => u.Id === blockId ? { ...u, Status: 'blocked' } : u));
            if (selectedFriend && selectedFriend.Id === blockId) {
                setSelectedFriend(null);
            }
        } catch (err) {
            console.error('Error blocking user:', err);
        }
    };
    
    const unblockUser = async (blockId) => {
        try {
            await axios.delete(`/api/friends/${blockId}`);
            fetchFriends();
            setSearchResults(prev => prev.map(u => u.Id === blockId ? { ...u, Status: null } : u));
        } catch (err) {
            console.error('Error unblocking user:', err);
        }
    };
    // Messages
    useEffect(() => {
        if (!selectedFriend || !user) return;
        setMessages([]);
        setHasMore(true);
        const fetchMessages = async () => {
            try {
                let url = `/api/messages?limit=20&user1=${user.Id}&user2=${selectedFriend.Id}`;
                const response = await axios.get(url, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });
                setMessages(response.data);
                if (response.data.length < 20) setHasMore(false);
                
                socket.emit('markAsRead', { senderId: selectedFriend.Id, receiverId: user.Id });
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
                let url = `/api/messages?limit=20&beforeId=${oldestMessageId}&user1=${user.Id}&user2=${selectedFriend.Id}`;
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
        const handleMessageDeleted = ({ messageId, type }) => {
            setMessages(prev => prev.map(msg => {
                if (msg.Id == messageId && type === 'everyone') {
                    return { ...msg, IsDeleted: true };
                }
                return msg;
            }));
        };

        const handleReceiveMessage = (message) => {
            if (message.SenderId != user.Id) {
                socket.emit('markAsDelivered', { messageId: message.Id, senderId: message.SenderId });
            }

            if (
                (selectedFriend && (message.SenderId == selectedFriend.Id || message.ReceiverId == selectedFriend.Id || (message.SenderId == user.Id && message.ReceiverId == selectedFriend.Id)))
            ) {
                setMessages(prev => [...prev, message]);
                if (message.SenderId != user.Id) {
                    playNotificationSound();
                    socket.emit('markAsRead', { senderId: message.SenderId, receiverId: user.Id });
                }
            } else if (message.SenderId != user.Id) {
                if (localStorage.getItem('soundEnabled') !== 'false') {
                    const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
                    audio.play().catch(e => console.error("Audio play error", e));
                }
                
                setUnreadCounts(prev => ({
                    ...prev,
                    [message.SenderId]: (prev[message.SenderId] || 0) + 1
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
            if (selectedFriend && data.senderId == selectedFriend.Id) {
                setIsTyping(data.isTyping);
            }
        };

        const handleMessageStatusChanged = ({ messageId, status }) => {
            setMessages(prev => prev.map(m => m.Id === messageId ? { ...m, IsDelivered: status === 'delivered' || m.IsDelivered, IsRead: status === 'read' ? true : m.IsRead } : m));
        };

        const handleMessagesRead = ({ byUserId }) => {
            setMessages(prev => prev.map(m => m.ReceiverId == byUserId ? { ...m, IsRead: true, IsDelivered: true } : m));
        };

        socket.on('connect', handleConnect);
        socket.on('receiveMessage', handleReceiveMessage);
        socket.on('messageStatusChanged', handleMessageStatusChanged);
        socket.on('messagesRead', handleMessagesRead);
        socket.on('onlineUsersList', handleOnlineUsersList);
        socket.on('userOnline', handleUserOnline);
        socket.on('userOffline', handleUserOffline);
        socket.on('typing', handleTyping);
        socket.on('messageDeleted', handleMessageDeleted);
        socket.on('friendRequestReceived', fetchFriends);
        socket.on('friendRequestAccepted', fetchFriends);
        socket.on('friendshipUpdated', fetchFriends);
        
        if (socket.connected && user) {
            socket.emit('join', user);
        }
        
        return () => {
            socket.off('connect', handleConnect);
            socket.off('receiveMessage', handleReceiveMessage);
            socket.off('messageStatusChanged', handleMessageStatusChanged);
            socket.off('messagesRead', handleMessagesRead);
            socket.off('onlineUsersList', handleOnlineUsersList);
            socket.off('userOnline', handleUserOnline);
            socket.off('userOffline', handleUserOffline);
            socket.off('typing', handleTyping);
            socket.off('friendRequestReceived', fetchFriends);
            socket.off('friendRequestAccepted', fetchFriends);
            socket.off('friendshipUpdated', fetchFriends);
        };
    }, [selectedFriend, user]);

    useEffect(() => {
        const handleCallRejected = () => {
            if (isCallerRef.current && selectedFriend) {
                const msgData = {
                    senderId: user.Id,
                    receiverId: selectedFriend.Id,
                    content: `📞 Cuộc gọi bị từ chối`,
                    username: user.Username,
                };
                socket.emit('sendMessage', msgData);
            }
            endCall();
        };
        
        const handleCallEnded = () => {
            endCall(false); // Do not emit event back
        };

        socket.on('callRejected', handleCallRejected);
        socket.on('callEnded', handleCallEnded);
        
        return () => {
            socket.off('callRejected', handleCallRejected);
            socket.off('callEnded', handleCallEnded);
        };
    }, [myStream, selectedFriend, user]); // myStream changes when call starts, so endCall gets fresh closure
    
    useEffect(() => {
        if (!user) return;
        console.log("Initializing PeerJS with host:", window.location.hostname, "port:", window.location.port);
        const newPeer = new Peer(user.Id.toString(), {
            host: window.location.hostname,
            port: parseInt(window.location.port || (window.location.protocol === 'https:' ? 443 : 80)),
            path: '/peerjs/myapp',
            secure: window.location.protocol === 'https:',
            debug: 3
        });
        
        newPeer.on('open', (id) => {
            console.log('PeerJS connected with ID:', id);
        });

        newPeer.on('error', (err) => {
            console.error('PeerJS connection error:', err);
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

    useEffect(() => {
        if (myVideoRef.current && myStream) {
            myVideoRef.current.srcObject = myStream;
        }
    }, [myStream, callActive]);

    useEffect(() => {
        if (remoteVideoRef.current && remoteStream) {
            remoteVideoRef.current.srcObject = remoteStream;
        }
    }, [remoteStream, callActive]);

    
    const handleDeleteMessage = async (msgId, type) => {
        try {
            await axios.delete(`/api/messages/${msgId}?type=${type}`, {
                headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
            });
            
            // local update
            setMessages(prev => prev.map(msg => {
                if (msg.Id == msgId) {
                    if (type === 'everyone') return { ...msg, IsDeleted: true };
                }
                return msg;
            }).filter(msg => !(msg.Id == msgId && type === 'me')));
            
        } catch (err) {
            console.error('Error deleting message:', err);
            alert('Lỗi: ' + (err.response?.data?.error || err.message));
        }
    };

    const handleReact = async (msgId, type) => {
        try {
            await axios.post(`/api/messages/${msgId}/react`, { reactionType: type }, {
                headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
            });
            
            // Fetch updated messages
            let url = `/api/messages?user1=${user.Id}&user2=${selectedFriend.Id}`;
            const response = await axios.get(url, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });
            setMessages(response.data);
        } catch (err) { console.error('Error reacting', err); }
    };
    
    const handlePin = async (msgId, isPinned) => {
        try {
            await axios.put(`/api/messages/${msgId}/pin`, { isPinned: !isPinned }, {
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
                receiverId: selectedFriend.Id,
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
            const response = await axios.post(`/api/users/avatar`, formData, {
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
        setEditProfileError('');
        try {
            const response = await axios.put(`/api/users/profile`, editProfileData, {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            });
            const updatedUser = response.data.user || { ...user, ...editProfileData };
            setUser(updatedUser);
            localStorage.setItem('user', JSON.stringify(updatedUser));
            setIsEditingProfile(false);
        } catch (err) {
            console.error('Failed to save profile:', err);
            if (err.response && err.response.data && err.response.data.error) {
                setEditProfileError(err.response.data.error);
            } else {
                setEditProfileError('Có lỗi xảy ra khi lưu thay đổi.');
            }
        }
    };

const handleMessageChange = (e) => {
        setNewMessage(e.target.value);
        if (!selectedFriend) return;

        socket.emit('typing', { senderId: user.Id, receiverId: selectedFriend.Id });

        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);

        typingTimeoutRef.current = setTimeout(() => {
            socket.emit('stopTyping', { senderId: user.Id, receiverId: selectedFriend.Id });
        }, 1500);
    };

    const handleImageUpload = async (e) => {
        const file = e.target.files[0];
        if (!file || !selectedFriend) return;

        const formData = new FormData();
        formData.append('image', file);

        try {
            const response = await axios.post(`/api/messages/image`, formData, {
                headers: { 'Content-Type': 'multipart/form-data', 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            });
            
            socket.emit('sendMessage', {
                senderId: user.Id,
                receiverId: selectedFriend.Id,
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
            const response = await axios.post(`/api/messages/file`, formData, {
                headers: { 'Content-Type': 'multipart/form-data', 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            });
            
            socket.emit('sendFileMessage', {
                senderId: user.Id,
                receiverId: selectedFriend.Id,
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
                        const res = await axios.post(`/api/messages/file`, formData, {
                            headers: { 'Content-Type': 'multipart/form-data', 'Authorization': `Bearer ${localStorage.getItem('token')}` }
                        });
                        socket.emit('sendFileMessage', {
                            senderId: user.Id,
                            receiverId: selectedFriend.Id,
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
            receiverId: selectedFriend.Id,
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
            setCallIsVideo(isVideo);
            
            if (peer && selectedFriend) {
                isCallerRef.current = true;
                const call = peer.call(selectedFriend.Id.toString(), stream, {
                    metadata: { callerName: user.Username, isVideo }
                });
                
                if (!call) {
                    alert("Could not connect to the peer server to place the call.");
                    endCall();
                    return;
                }
                
                currentCallRef.current = call;
                
                callTimeoutRef.current = setTimeout(() => {
                    if (selectedFriend) {
                        const msgData = {
                            senderId: user.Id,
                            receiverId: selectedFriend.Id,
                            content: `📞 Cuộc gọi nhỡ`,
                            username: user.Username,
                        };
                        socket.emit('sendMessage', msgData);
                    }
                    endCall();
                }, 60000);
                
                call.on('stream', (userVideoStream) => {
                    if (callTimeoutRef.current) {
                        clearTimeout(callTimeoutRef.current);
                        callTimeoutRef.current = null;
                    }
                    setRemoteStream(userVideoStream);
                    if (!callStartTimeRef.current) callStartTimeRef.current = Date.now();
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
            setCallIsVideo(incomingCall.isVideo);
            
            const call = incomingCall.call;
            currentCallRef.current = call;
            isCallerRef.current = false;
            
            call.answer(stream);
            
            call.on('stream', (userVideoStream) => {
                if (callTimeoutRef.current) {
                    clearTimeout(callTimeoutRef.current);
                    callTimeoutRef.current = null;
                }
                setRemoteStream(userVideoStream);
                if (!callStartTimeRef.current) callStartTimeRef.current = Date.now();
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

    const endCall = (emitEvent = true) => {
        if (callTimeoutRef.current) {
            clearTimeout(callTimeoutRef.current);
            callTimeoutRef.current = null;
        }
        
        if (isCallerRef.current && selectedFriend) {
            if (callStartTimeRef.current) {
                const durationMs = Date.now() - callStartTimeRef.current;
                const durationSec = Math.floor(durationMs / 1000);
                const minutes = Math.floor(durationSec / 60);
                const seconds = durationSec % 60;
                const durationStr = `${minutes}:${seconds.toString().padStart(2, '0')}`;
                
                const msgData = {
                    senderId: user.Id,
                    receiverId: selectedFriend.Id,
                    content: `📞 Cuộc gọi - Thời lượng: ${durationStr}`,
                    username: user.Username,
                };
                socket.emit('sendMessage', msgData);
            } else {
                const msgData = {
                    senderId: user.Id,
                    receiverId: selectedFriend.Id,
                    content: `📞 Cuộc gọi nhỡ`,
                    username: user.Username,
                };
                socket.emit('sendMessage', msgData);
            }
        }
        
        // Notify the other peer explicitly over socket to prevent frozen call states
        if (emitEvent !== false && selectedFriend) {
            socket.emit('endCall', { receiverId: selectedFriend.Id });
        }
        
        callStartTimeRef.current = null;
        isCallerRef.current = false;
        
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

    const handleSetNickname = async () => {
        try {
            const res = await fetch(`/api/friends/nickname`, {
                method: 'POST',
                headers: { 
                    'Authorization': `Bearer ${localStorage.getItem('token')}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ friendId: selectedFriend.Id, nickname })
            });
            if (res.ok) {
                const updatedFriend = { ...selectedFriend, Nickname: nickname };
                setSelectedFriend(updatedFriend);
                setFriendsList(prev => prev.map(f => f.Id === selectedFriend.Id ? updatedFriend : f));
                setShowNicknameModal(false);
            } else {
                alert('Có lỗi xảy ra khi lưu biệt danh');
            }
        } catch (error) {
            console.error('Error setting nickname:', error);
            alert('Có lỗi xảy ra khi lưu biệt danh');
        }
    };

    const handleArchiveChat = async () => {
        try {
            if (selectedFriend.IsArchived) {
                await fetch(`/api/archive/${selectedFriend.Id}`, {
                    method: 'DELETE',
                    headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
                });
            } else {
                await fetch(`/api/archive`, {
                    method: 'POST',
                    headers: { 
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${localStorage.getItem('token')}` 
                    },
                    body: JSON.stringify({ friendId: selectedFriend.Id })
                });
            }
            setSelectedFriend(null);
            fetchFriends(); // Refresh list to remove/add from archive
        } catch (err) {
            console.error('Failed to toggle archive', err);
        }
    };

    const handleBlockUser = async () => {
        setConfirmDialog({
            isOpen: true,
            title: 'Block User',
            message: 'Are you sure you want to block this user? They will not be able to send you messages.',
            onConfirm: async () => {
                setConfirmDialog({ isOpen: false, title: '', message: '', onConfirm: null });
        try {
            await axios.put(`/api/friends/block`, { userId: user.Id, blockId: selectedFriend.Id }, {
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
            await axios.delete(`/api/messages/chat/${selectedFriend.Id}`, {
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

    const activeFriends = friendsList.filter(f => f.Status === 'accepted' && f.IsArchived !== 1);
    const archivedFriends = friendsList.filter(f => f.Status === 'accepted' && f.IsArchived === 1);
    const pendingRequests = friendsList.filter(f => f.Status === 'pending' && String(f.AddresseeId) === String(user.Id));

    const renderListPane = () => {
        if (activeTab === 'chats') {
            return (
                <>
                    <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px'}}>
                        <h2 style={{margin: 0, fontSize: '24px', fontWeight: 'bold'}}>{getText('chatList')}</h2>
                        <div style={{display: 'flex', gap: '8px'}}>
                            <div style={{width: '36px', height: '36px', borderRadius: '50%', background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'background 0.2s'}} onMouseOver={e => e.currentTarget.style.background='rgba(255,255,255,0.1)'} onMouseOut={e => e.currentTarget.style.background='rgba(255,255,255,0.05)'}>
                                <MoreHorizontal size={20} color="var(--text-primary)" />
                            </div>
                            <div style={{width: '36px', height: '36px', borderRadius: '50%', background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'background 0.2s'}} onMouseOver={e => e.currentTarget.style.background='rgba(255,255,255,0.1)'} onMouseOut={e => e.currentTarget.style.background='rgba(255,255,255,0.05)'}>
                                <Edit2 size={20} color="var(--text-primary)" />
                            </div>
                        </div>
                    </div>
                    <div className="search-bar" style={{width: '100%', marginBottom: '16px', borderRadius: '20px', padding: '8px 16px'}}>
                        <Search size={18} className="search-icon" color="var(--text-secondary)" />
                        <input key="chats-search" type="text" placeholder={getText('search')} style={{marginLeft: '8px'}} />
                    </div>
                    <div className="chat-items">
                        
                        {activeFriends.length === 0 ? (
                            <div style={{color: 'var(--text-secondary)', padding: '16px'}}>{getText('homeDesc')}</div>
                        ) : (
                            activeFriends.map(friend => (
                                <div 
                                    key={friend.Id} 
                                    className={`chat-item ${selectedFriend?.Id == friend.Id ? 'active' : ''}`}
                                    onClick={() => handleSelectFriend(friend)}
                                >
                                    <div style={{position: 'relative'}}>
                                        <div className="chat-avatar" style={{background: 'var(--primary-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', overflow: 'hidden'}}>
                                            {friend.AvatarUrl ? <img src={`${friend.AvatarUrl}`} alt="Avatar" style={{width: '100%', height: '100%', objectFit: 'cover'}}/> : <UserIcon size={24} />}
                                        </div>
                                        <div className="chat-status-dot" style={{ backgroundColor: onlineUsers.has(friend.Id) ? '#22c55e' : '#6b7280' }}></div>
                                    </div>
                                    <div className="chat-item-info">
                                        <div className="chat-item-top">
                                            <span className="chat-item-name">{friend.Nickname || friend.FullName || friend.Username}</span>
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
        
        if (activeTab === 'archive') {
            return (
                <>
                    <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px'}}>
                        <h2 style={{margin: 0, fontSize: '24px', fontWeight: 'bold'}}>Kho lưu trữ</h2>
                    </div>
                    <div className="search-bar" style={{width: '100%', marginBottom: '16px', borderRadius: '20px', padding: '8px 16px'}}>
                        <Search size={18} className="search-icon" color="var(--text-secondary)" />
                        <input key="archive-search" type="text" placeholder={getText('search')} style={{marginLeft: '8px'}} />
                    </div>
                    <div className="chat-items">
                        {archivedFriends.length === 0 ? (
                            <div style={{color: 'var(--text-secondary)', padding: '16px'}}>Không có đoạn chat nào trong kho lưu trữ.</div>
                        ) : (
                            archivedFriends.map(friend => (
                                <div 
                                    key={friend.Id} 
                                    className={`chat-item ${selectedFriend?.Id == friend.Id ? 'active' : ''}`}
                                    onClick={() => handleSelectFriend(friend)}
                                >
                                    <div style={{position: 'relative'}}>
                                        <div className="chat-avatar" style={{background: 'var(--primary-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', overflow: 'hidden'}}>
                                            {friend.AvatarUrl ? <img src={`${friend.AvatarUrl}`} alt="Avatar" style={{width: '100%', height: '100%', objectFit: 'cover'}}/> : <UserIcon size={24} />}
                                        </div>
                                    </div>
                                    <div className="chat-item-info">
                                        <div className="chat-item-top">
                                            <span className="chat-item-name">{friend.Nickname || friend.FullName || friend.Username}</span>
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
            const blockedUsers = friendsList.filter(f => f.Status === 'blocked' && String(f.RequesterId) === String(user.Id));
            const suggestions = searchResults.filter(su => !su.Status || su.Status === 'declined' || (su.Status === 'pending' && String(su.RequesterId) === String(user.Id)));

            return (
                <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                    <div className="chat-list-header" style={{ paddingBottom: 0 }}>
                        <h2 style={{ marginBottom: '16px' }}>{getText('people') || 'Mọi người'}</h2>
                        
                        {/* Sub-tabs */}
                        <div style={{ display: 'flex', gap: '16px', borderBottom: '1px solid var(--glass-border)', paddingBottom: '8px', marginBottom: '16px' }}>
                            <div 
                                onClick={() => setPeopleSubTab('friends')}
                                style={{ 
                                    cursor: 'pointer', 
                                    color: peopleSubTab === 'friends' ? 'var(--primary-color)' : 'var(--text-secondary)',
                                    fontWeight: peopleSubTab === 'friends' ? 'bold' : 'normal',
                                    borderBottom: peopleSubTab === 'friends' ? '2px solid var(--primary-color)' : 'none',
                                    paddingBottom: '4px'
                                }}
                            >
                                Bạn bè ({activeFriends.length})
                            </div>
                            <div 
                                onClick={() => setPeopleSubTab('suggestions')}
                                style={{ 
                                    cursor: 'pointer', 
                                    color: peopleSubTab === 'suggestions' ? 'var(--primary-color)' : 'var(--text-secondary)',
                                    fontWeight: peopleSubTab === 'suggestions' ? 'bold' : 'normal',
                                    borderBottom: peopleSubTab === 'suggestions' ? '2px solid var(--primary-color)' : 'none',
                                    paddingBottom: '4px'
                                }}
                            >
                                Gợi ý kết bạn
                            </div>
                        </div>
                    </div>
                    
                    <div className="chat-items" style={{ flex: 1, overflowY: 'auto', padding: '0 16px 16px', paddingTop: '16px' }}>
                        {peopleSubTab === 'friends' ? (
                            <>
                                {pendingRequests.length > 0 && (
                                    <div style={{marginBottom: '24px'}}>
                                        <h3 style={{fontSize: '12px', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '8px'}}>Lời mời kết bạn</h3>
                                        {pendingRequests.map(req => (
                                            <div key={req.Id} className="chat-item">
                                                <div className="chat-avatar" style={{background: 'var(--primary-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', overflow: 'hidden'}}>
                                                    {req.AvatarUrl ? <img src={`${req.AvatarUrl}`} alt="Avatar" style={{width: '100%', height: '100%', objectFit: 'cover'}}/> : <UserIcon size={24} />}
                                                </div>
                                                <div className="chat-item-info">
                                                    <span className="chat-item-name">{req.Nickname || req.FullName || req.Username}</span>
                                                </div>
                                                <button onClick={() => acceptFriendRequest(req.RequesterId)} style={{background: 'var(--primary-color)', color: 'white', border: 'none', borderRadius: '8px', padding: '6px 12px', cursor: 'pointer'}}>
                                                    Chấp nhận
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                <div style={{marginBottom: '24px'}}>
                                    <h3 style={{fontSize: '12px', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '8px'}}>Bạn bè</h3>
                                    {activeFriends.length === 0 ? (
                                        <div style={{color: 'var(--text-secondary)', fontSize: '14px'}}>Chưa có bạn bè nào</div>
                                    ) : (
                                        activeFriends.map(friend => (
                                            <div key={friend.Id} className="chat-item">
                                                <div className="chat-avatar" style={{background: 'var(--primary-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', overflow: 'hidden'}}>
                                                    {friend.AvatarUrl ? <img src={`${friend.AvatarUrl}`} alt="Avatar" style={{width: '100%', height: '100%', objectFit: 'cover'}}/> : <UserIcon size={24} />}
                                                </div>
                                                <div className="chat-item-info">
                                                    <span className="chat-item-name">{friend.Nickname || friend.FullName || friend.Username}</span>
                                                </div>
                                                <div style={{display: 'flex', gap: '8px'}}>
                                                    <button onClick={() => unfriendUser(friend.Id)} style={{background: 'rgba(255,100,100,0.1)', border: '1px solid rgba(255,100,100,0.3)', borderRadius: '8px', padding: '6px 12px', cursor: 'pointer', color: '#ff6b6b', fontSize: '13px'}}>
                                                        Xóa
                                                    </button>
                                                    <button onClick={() => blockUser(friend.Id)} style={{background: 'rgba(255,255,255,0.1)', border: '1px solid var(--glass-border)', borderRadius: '8px', padding: '6px 12px', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: '13px'}}>
                                                        Chặn
                                                    </button>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </>
                        ) : (
                            <>
                                <div className="search-bar" style={{marginBottom: '16px'}}>
                                    <Search size={18} className="search-icon" color="var(--text-secondary)" />
                                    <input 
                                        key="people-search"
                                        type="text" 
                                        placeholder="Tìm kiếm người dùng..." 
                                        value={searchQuery}
                                        onChange={e => setSearchQuery(e.target.value)}
                                    />
                                </div>
                                {suggestions.length === 0 ? (
                                    <div style={{color: 'var(--text-secondary)', padding: '8px'}}>Không tìm thấy ai</div>
                                ) : (
                                    suggestions.map(su => (
                                        <div key={su.Id} className="chat-item">
                                            <div className="chat-avatar" style={{background: 'var(--primary-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', overflow: 'hidden'}}>
                                                {su.AvatarUrl ? <img src={`${su.AvatarUrl}`} alt="Avatar" style={{width: '100%', height: '100%', objectFit: 'cover'}}/> : <UserIcon size={24} />}
                                            </div>
                                            <div className="chat-item-info">
                                                <span className="chat-item-name">{su.FullName || su.Username}</span>
                                            </div>
                                            {su.Status === 'pending' && String(su.RequesterId) === String(user.Id) ? (
                                                <button disabled style={{background: 'var(--glass-border)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '6px 16px', cursor: 'not-allowed', color: 'var(--text-secondary)'}}>
                                                    Đã gửi
                                                </button>
                                            ) : (
                                                <button onClick={() => sendFriendRequest(su.Id)} style={{background: 'var(--primary-color)', border: 'none', borderRadius: '8px', padding: '6px 16px', cursor: 'pointer', color: 'white'}}>
                                                    Kết bạn
                                                </button>
                                            )}
                                        </div>
                                    ))
                                )}
                            </>
                        )}
                    </div>
                </div>
            );
        }

        if (activeTab === 'profile') {
            return (
                <>
                    <div className="chat-list-header" style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                        <h2>{getText('profile') || 'Profile'}</h2>
                        <button className="btn-edit-profile" onClick={() => { setEditProfileData({ FullName: user.FullName || '', Bio: user.Bio || '', Username: user.Username || '', Email: user.Email || '', DateOfBirth: user.DateOfBirth ? user.DateOfBirth.split('T')[0] : '', Password: '' }); setEditProfileError(''); setIsEditingProfile(true); }} style={{background: 'rgba(255,255,255,0.1)', border: 'none', color: 'var(--text-primary)', padding: '6px 12px', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px'}}>
                            <Edit2 size={14} /> Edit Profile
                        </button>
                    </div>
                    <div className="profile-container" style={{padding: '20px 0'}}>
                        <div className="profile-avatar-wrapper" style={{marginBottom: '16px'}}>
                            {user.AvatarUrl ? (
                                <img src={`${user.AvatarUrl}`} alt="Avatar" className="profile-avatar" />
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

        return null;
    };

    return (
        <div className="app-container">
            <div className={`main-layout ${selectedFriend ? 'has-active-chat' : ''}`}>
                {/* COLUMN 1: SIDEBAR NAV */}
                <nav className="sidebar-nav">
                    <div className="nav-items">
                        <button className={`nav-item ${activeTab === 'chats' ? 'active' : ''}`} onClick={() => setActiveTab('chats')} title={getText('chats')}>
                            <MessageSquare size={24} />
                            <span>Đoạn chat</span>
                        </button>
                        <button className={`nav-item ${activeTab === 'people' ? 'active' : ''}`} onClick={() => setActiveTab('people')} title={getText('people')}>
                            <Users size={24} />
                            <span>Mọi người</span>
                        </button>
                        <button className={`nav-item ${activeTab === 'archive' ? 'active' : ''}`} onClick={() => setActiveTab('archive')} title="Kho lưu trữ">
                            <Archive size={24} />
                            <span>Kho lưu trữ</span>
                        </button>
                    </div>
                    <div className="nav-bottom">
                        <div className="nav-item" style={{display: 'flex', alignItems: 'center', gap: '12px', position: 'relative', width: '100%', padding: '8px'}} ref={profileMenuRef} onClick={() => setShowProfileMenu(!showProfileMenu)}>
                            <div style={{width: '36px', height: '36px', borderRadius: '50%', background: 'var(--primary-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', overflow: 'hidden', flexShrink: 0}}>
                                {user.AvatarUrl ? <img src={`${user.AvatarUrl}`} alt="Avatar" style={{width: '100%', height: '100%', objectFit: 'cover'}}/> : <UserIcon size={20} />}
                            </div>
                            <span style={{flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontWeight: '600', color: 'var(--text-primary)', fontSize: '15px'}}>{user.FullName || user.Username}</span>
                            <Settings size={20} style={{color: 'var(--text-secondary)'}} />
                            
                            {showProfileMenu && (
                                <div className="profile-popup-menu" style={{
                                    position: 'absolute',
                                    left: '0',
                                    bottom: '100%',
                                    marginBottom: '16px',
                                    background: 'var(--bg-color)',
                                    border: '1px solid var(--glass-border)',
                                    borderRadius: '12px',
                                    width: '280px',
                                    boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
                                    zIndex: 1000,
                                    display: 'flex',
                                    flexDirection: 'column',
                                    overflow: 'hidden'
                                }}>
                                    <div className="profile-menu-item" onClick={() => { setShowSettingsModal(true); setShowProfileMenu(false); }}>
                                        <Settings size={18} />
                                        <span>Tùy chọn</span>
                                    </div>
                                    <div className="profile-menu-item" onClick={() => { setEditProfileData({ FullName: user.FullName || '', Bio: user.Bio || '', Username: user.Username || '', Email: user.Email || '', DateOfBirth: user.DateOfBirth ? user.DateOfBirth.split('T')[0] : '', Password: '' }); setEditProfileError(''); setIsEditingProfile(true); setShowProfileMenu(false); }}>
                                        <Edit2 size={18} />
                                        <span>Chỉnh sửa tên người dùng</span>
                                    </div>
                                    <div className="profile-menu-item" onClick={() => { setShowBlockedModal(true); setShowProfileMenu(false); }}>
                                        <Ban size={18} />
                                        <span>Danh sách chặn</span>
                                    </div>
                                    <div className="profile-menu-divider"></div>
                                    <div className="profile-menu-item" onClick={() => { setPolicyType('terms'); setShowPolicyModal(true); setShowProfileMenu(false); }}>
                                        <FileText size={18} />
                                        <span>Điều khoản</span>
                                    </div>
                                    <div className="profile-menu-item" onClick={() => { setPolicyType('privacy'); setShowPolicyModal(true); setShowProfileMenu(false); }}>
                                        <FileText size={18} />
                                        <span>Chính sách quyền riêng tư</span>
                                    </div>
                                    <div className="profile-menu-item" onClick={() => { setPolicyType('cookie'); setShowPolicyModal(true); setShowProfileMenu(false); }}>
                                        <FileText size={18} />
                                        <span>Chính sách về cookie</span>
                                    </div>
                                    <div className="profile-menu-divider"></div>
                                    <div className="profile-menu-item" onClick={() => { handleLogout(); setShowProfileMenu(false); }}>
                                        <LogOut size={18} />
                                        <span>Đăng xuất</span>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </nav>

                {/* COLUMN 2: CHAT LIST */}
                <aside className="chat-list-pane">
                    {renderListPane()}
                </aside>

                {/* COLUMN 3: MAIN CHAT */}
                <main className="main-chat-pane">
                    {(activeTab === 'chats' || activeTab === 'archive') && selectedFriend ? (
                        <>
                            <header className="main-chat-header">
                                <div className="header-user-info">
                                    <button className="mobile-back-btn" onClick={() => setSelectedFriend(null)} title="Back">
                                        <ArrowLeft size={20} />
                                    </button>
                                    <div className="chat-avatar" style={{background: 'var(--primary-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', overflow: 'hidden'}}>
                                        {selectedFriend.AvatarUrl ? <img src={`${selectedFriend.AvatarUrl}`} alt="Avatar" style={{width: '100%', height: '100%', objectFit: 'cover'}}/> : <UserIcon size={24} />}
                                    </div>
                                    <div className="header-user-text">
                                        <h3>{selectedFriend.Nickname || selectedFriend.FullName || selectedFriend.Username}</h3>
                                        <div className="header-user-status">
                                            <div className="chat-status-dot" style={{ backgroundColor: onlineUsers.has(selectedFriend.Id) ? '#22c55e' : '#6b7280', position: 'relative', border: 'none', width: '10px', height: '10px', marginRight: '6px' }}></div> 
                                            {onlineUsers.has(selectedFriend.Id) ? getText('online') : getText('offline')} 
                                            {isTyping && <span style={{marginLeft: '4px', fontStyle: 'italic', color: 'var(--primary-color)'}}>- {getText('typing')}...</span>}
                                        </div>
                                    </div>
                                </div>
                                <div className="header-actions" style={{display: 'flex', alignItems: 'center', gap: '16px'}}>
                                    <Phone size={24} style={{cursor: 'pointer', color: 'var(--primary-color)'}} title={getText('audioCall')} onClick={() => initiateCall('audio')} />
                                    <Video size={24} style={{cursor: 'pointer', color: 'var(--primary-color)'}} title={getText('videoCall')} onClick={() => initiateCall('video')} />
                                    <Info size={24} style={{cursor: 'pointer', color: 'var(--primary-color)'}} title="Thông tin" />
                                </div>
                            </header>

                            {showSearchMessages && (
                                <div style={{padding: '12px 24px', borderBottom: '1px solid var(--glass-border)', background: 'var(--bg-secondary)', display: 'flex', alignItems: 'center', gap: '12px'}}>
                                    <Search size={18} color="var(--text-secondary)" />
                                    <input 
                                        type="text" 
                                        placeholder="Tìm kiếm tin nhắn..." 
                                        value={searchMessageTerm}
                                        onChange={e => setSearchMessageTerm(e.target.value)}
                                        style={{flex: 1, background: 'transparent', border: 'none', color: 'var(--text-primary)', outline: 'none', fontSize: '14px'}}
                                        autoFocus
                                    />
                                    <button onClick={() => { setShowSearchMessages(false); setSearchMessageTerm(''); }} style={{background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
                                        <X size={18} />
                                    </button>
                                </div>
                            )}

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
                                                            <img src={`${user.AvatarUrl}`} alt="Avatar" style={{width: '100%', height: '100%', objectFit: 'cover'}}/>
                                                        ) : (!isMine && msg.AvatarUrl) ? (
                                                            <img src={`${msg.AvatarUrl}`} alt="Avatar" style={{width: '100%', height: '100%', objectFit: 'cover'}}/>
                                                        ) : (!isMine && selectedFriend && selectedFriend.AvatarUrl) ? (
                                                            <img src={`${selectedFriend.AvatarUrl}`} alt="Avatar" style={{width: '100%', height: '100%', objectFit: 'cover'}}/>
                                                        ) : (
                                                            <UserIcon size={12} />
                                                        )}
                                                    </div>
                                                    <span>{isMine ? getText('you') : (msg.FullName || msg.Username || selectedFriend.Nickname || selectedFriend.FullName || selectedFriend.Username)}</span>
                                                    <span style={{fontSize: '11px'}}>{new Date(msg.CreatedAt || Date.now()).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                                                </div>
                                                <div className="message-content-wrapper" style={{display: 'flex', flexDirection: 'column', alignItems: isMine ? 'flex-end' : 'flex-start'}}>
                                                    {msg.ReplyToMessageId && (() => {
                                                        const repliedMsg = messages.find(m => m.Id == msg.ReplyToMessageId);
                                                        if (repliedMsg) {
                                                            return (
                                                                <div style={{fontSize: '12px', color: 'var(--text-secondary)', background: 'var(--bg-secondary)', padding: '4px 8px', borderRadius: '4px', marginBottom: '4px', maxWidth: '100%', opacity: 0.8, borderLeft: `3px solid var(--primary-color)`}}>
                                                                    <strong>{repliedMsg.Nickname || repliedMsg.FullName || repliedMsg.Username}:</strong> {repliedMsg.Content ? (repliedMsg.Content.length > 30 ? repliedMsg.Content.substring(0, 30) + '...' : repliedMsg.Content) : 'Media'}
                                                                </div>
                                                            );
                                                        }
                                                        return null;
                                                    })()}
                                                    <div style={{display: 'flex', flexDirection: isMine ? 'row-reverse' : 'row', alignItems: 'center'}} onMouseEnter={() => setHoveredMessageId(msg.Id)} onMouseLeave={() => setHoveredMessageId(null)}>
                                                        <div className="message-bubble">
                                                            {msg.IsDeleted ? (
                                                                <div style={{fontStyle: 'italic', color: 'gray'}}>
                                                                    Tin nhắn đã bị thu hồi
                                                                </div>
                                                            ) : msg.ImageUrl ? (
                                                                <div>
                                                                    
                                                                    {msg.Content !== 'Sent an image' && msg.Content !== '' && (
                                                                        <div style={{marginBottom: '8px'}}>
                                                                            {msg.Content}
                                                                            {msg.Content.match(/https?:\/\/[^\s]+/) && (
                                                                                <LinkPreview url={msg.Content.match(/https?:\/\/[^\s]+/)[0]} />
                                                                            )}
                                                                        </div>
                                                                    )}

                                                                    <img src={msg.ImageUrl.startsWith('http') ? msg.ImageUrl : `${msg.ImageUrl}`} alt="attachment" className="chat-image" />
                                                                </div>
                                                            ) : msg.AttachmentUrl ? (
                                                                <div>
                                                                    {msg.Content && <div style={{marginBottom: '8px'}}>{msg.Content}</div>}
                                                                    {msg.AttachmentUrl.endsWith('.webm') ? (
                                                                        <audio controls src={msg.AttachmentUrl.startsWith('http') ? msg.AttachmentUrl : `${msg.AttachmentUrl}`} style={{maxWidth: '200px'}} />
                                                                    ) : (
                                                                        <div style={{display: 'flex', alignItems: 'center', background: 'rgba(0,0,0,0.1)', padding: '8px', borderRadius: '8px'}}>
                                                                            <Folder size={20} style={{marginRight: '8px', color: 'var(--primary-color)'}} />
                                                                            <a href={`${msg.AttachmentUrl}`} target="_blank" rel="noopener noreferrer" style={{color: 'var(--primary-color)', textDecoration: 'none'}}>{getText('downloadFile')}</a>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            ) : (
                                                                msg.Content
                                                            )}
                                                        </div>
                                                        {(hoveredMessageId === msg.Id || activeDropdownId === msg.Id || activeReactionBarId === msg.Id) && (
                                                            <div className="message-actions-group" style={{padding: '0 8px'}}>
                                                                
                                                                <button className="message-action-btn" onClick={() => setReplyingTo(msg)} title="Trả lời">
                                                                    <Reply size={16} />
                                                                </button>
                                                                
                                                                <div style={{position: 'relative'}}>
                                                                    <button className="message-action-btn" onClick={() => { setActiveReactionBarId(activeReactionBarId === msg.Id ? null : msg.Id); setActiveDropdownId(null); }} title="Thả cảm xúc">
                                                                        <Smile size={16} />
                                                                    </button>
                                                                    {activeReactionBarId === msg.Id && (
                                                                        <div className="reaction-bar">
                                                                            <span style={{cursor: 'pointer', fontSize: '20px'}} onClick={() => { handleReact(msg.Id, '❤️'); setActiveReactionBarId(null); }} title="Love">❤️</span>
                                                                            <span style={{cursor: 'pointer', fontSize: '20px'}} onClick={() => { handleReact(msg.Id, '😆'); setActiveReactionBarId(null); }} title="Haha">😆</span>
                                                                            <span style={{cursor: 'pointer', fontSize: '20px'}} onClick={() => { handleReact(msg.Id, '😮'); setActiveReactionBarId(null); }} title="Wow">😮</span>
                                                                            <span style={{cursor: 'pointer', fontSize: '20px'}} onClick={() => { handleReact(msg.Id, '😢'); setActiveReactionBarId(null); }} title="Sad">😢</span>
                                                                            <span style={{cursor: 'pointer', fontSize: '20px'}} onClick={() => { handleReact(msg.Id, '😡'); setActiveReactionBarId(null); }} title="Angry">😡</span>
                                                                            <span style={{cursor: 'pointer', fontSize: '20px'}} onClick={() => { handleReact(msg.Id, '👍'); setActiveReactionBarId(null); }} title="Like">👍</span>
                                                                        </div>
                                                                    )}
                                                                </div>

                                                                <div style={{position: 'relative'}}>
                                                                    <button className="message-action-btn" onClick={() => { setActiveDropdownId(activeDropdownId === msg.Id ? null : msg.Id); setActiveReactionBarId(null); }} title="Thêm">
                                                                        <MoreVertical size={16} />
                                                                    </button>
                                                                    {activeDropdownId === msg.Id && (
                                                                        <div className="message-dropdown">
                                                                            {isMine && !msg.IsDeleted && <button className="message-dropdown-item" onClick={() => { handleDeleteMessage(msg.Id, 'everyone'); setActiveDropdownId(null); }}>Thu hồi</button>}
                                                                            <button className="message-dropdown-item" onClick={() => { handleDeleteMessage(msg.Id, 'me'); setActiveDropdownId(null); }}>Xóa phía tôi</button>
                                                                            <button className="message-dropdown-item" onClick={() => setActiveDropdownId(null)}>Chuyển tiếp</button>
                                                                            <button className="message-dropdown-item" onClick={() => setActiveDropdownId(null)}>Ghim</button>
                                                                            <button className="message-dropdown-item" onClick={() => setActiveDropdownId(null)}>Báo cáo</button>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        )}
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
                                                    <div className="message-status" style={{fontSize: '11px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px', alignSelf: 'flex-end', marginTop: '2px'}}>
                                                        {msg.IsRead ? (
                                                            <><CheckCheck size={14} color="#4CAF50" /> {getText('read')}</>
                                                        ) : msg.IsDelivered ? (
                                                            <><CheckCheck size={14} /> Đã nhận</>
                                                        ) : (
                                                            <><Check size={14} /> Đã gửi</>
                                                        )}
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
            <div className="input-actions" style={{display: 'flex', gap: '12px', alignItems: 'center'}}>
                <label style={{cursor: 'pointer', display: 'flex', alignItems: 'center'}} title={getText('attachDoc')}>
                    <Plus size={24} style={{color: 'var(--primary-color)'}} />
                    <input type="file" style={{display: 'none'}} onChange={handleDocumentUpload} />
                </label>
                <label style={{cursor: 'pointer', display: 'flex', alignItems: 'center'}} title={getText('attachImage')}>
                    <ImageIcon size={24} style={{color: 'var(--primary-color)'}} />
                    <input type="file" style={{display: 'none'}} accept="image/*" onChange={handleImageUpload} />
                </label>
                                        <Sticker size={24} style={{cursor: 'pointer', color: 'var(--primary-color)'}} onClick={() => {setShowStickerPicker(!showStickerPicker); setShowEmojiPicker(false);}} />
                                    </div>

                                    <div className="input-main" style={{position: 'relative', flex: 1}}>
                                        {showEmojiPicker && (
                                            <div style={{position: 'absolute', bottom: '100%', right: '0', zIndex: 100, marginBottom: '10px'}}>
                                                <EmojiPicker onEmojiClick={(emojiData) => setNewMessage(prev => prev + emojiData.emoji)} theme={isDarkMode ? 'dark' : 'light'} />
                                            </div>
                                        )}
                                        {showStickerPicker && (
                                            <div style={{position: 'absolute', bottom: '100%', left: '0', zIndex: 100, marginBottom: '10px', background: 'var(--glass-bg)', padding: '10px', borderRadius: '8px', display: 'flex', gap: '8px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)'}}>
                                                {STICKERS.map((s, i) => (
                                                    <img key={i} src={s} alt="Sticker" style={{width: '60px', height: '60px', cursor: 'pointer', borderRadius: '4px'}} onClick={() => sendSticker(s)} />
                                                ))}
                                            </div>
                                        )}
                                        
                                        <input
                                            type="text"
                                            placeholder="Aa"
                                            value={newMessage}
                                            onChange={handleMessageChange}
                                            style={{flex: 1, background: 'transparent', border: 'none', outline: 'none', color: 'var(--text-primary)', fontSize: '15px'}}
                                        />
                                        <Smile size={24} style={{color: 'var(--primary-color)', cursor: 'pointer', marginLeft: '8px'}} onClick={() => {setShowEmojiPicker(!showEmojiPicker); setShowStickerPicker(false);}} />
                                    </div>
                                    <div className="input-actions">
                                        <button type="submit" style={{background: 'transparent', border: 'none', color: 'var(--primary-color)', cursor: 'pointer', display: 'flex', alignItems: 'center'}} disabled={!newMessage.trim()}>
                                            <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
                                                <path d="M16.6915026,12.4744748 L3.22625384,8.02870234 C2.51181073,7.79274323 2.50293116,6.72121334 3.21041183,6.48002013 L21.0822606,0.38076615 C21.8021815,0.134988017 22.4419912,0.854084343 22.1098679,1.54228966 L15.6568853,14.9126487 C15.3418579,15.5652599 14.3644917,15.5032532 14.1374521,14.8197779 L11.7588726,7.66699222 L16.6915026,12.4744748 Z"></path>
                                            </svg>
                                        </button>
                                    </div>
                                </form>
                            </div>
                        </>
                    ) : (
                        <div style={{height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)'}}>
                            <MessageSquare size={64} style={{marginBottom: '16px', opacity: 0.5}} />
                            <h2>{getText('selectChat')}</h2>
                            <p>{getText('selectChatDesc')}</p>
                        </div>
                    )}
                </main>

                {/* COLUMN 4: CONVERSATION DETAILS PANE */}
                {selectedFriend && activeTab !== 'profile' && (
                    <aside className="conversation-details-pane">
                        <div className="details-profile" style={{display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: '32px'}}>
                            <div className="chat-avatar" style={{width: '72px', height: '72px', margin: '0 auto 12px', background: 'var(--primary-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', color: 'white', position: 'relative'}}>
                                {selectedFriend.AvatarUrl ? <img src={`${selectedFriend.AvatarUrl}`} alt="Avatar" style={{width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%'}}/> : <UserIcon size={36} />}
                                <div className="chat-status-dot" style={{position: 'absolute', bottom: '2px', right: '2px', border: '3px solid var(--bg-color)', background: onlineUsers.has(selectedFriend.Id) ? '#22c55e' : '#94a3b8', width: '16px', height: '16px', borderRadius: '50%'}}></div>
                            </div>
                            <h3 style={{margin: '0 0 4px', fontSize: '20px', fontWeight: '600', color: 'var(--text-primary)'}}>{selectedFriend.Nickname || selectedFriend.FullName || selectedFriend.Username}</h3>
                            <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', color: 'var(--text-secondary)', fontSize: '13px', marginBottom: '24px'}}>
                                <span>{onlineUsers.has(selectedFriend.Id) ? 'Đang hoạt động' : 'Không hoạt động'}</span>
                            </div>
                            
                            <div className="details-actions-row" style={{display: 'flex', justifyContent: 'center', gap: '16px', marginBottom: '24px'}}>
                                <div className="details-action-btn" onClick={() => setShowFriendProfileModal(true)} style={{display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'pointer', gap: '8px'}}>
                                    <div style={{width: '36px', height: '36px', borderRadius: '50%', background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
                                        <UserIcon size={20} color="var(--text-primary)" />
                                    </div>
                                    <span style={{fontSize: '12px', color: 'var(--text-secondary)'}}>Trang cá nhân</span>
                                </div>
                                <div className="details-action-btn" onClick={() => { setNickname(selectedFriend.Nickname || ''); setShowNicknameModal(true); }} style={{display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'pointer', gap: '8px'}}>
                                    <div style={{width: '36px', height: '36px', borderRadius: '50%', background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
                                        <Edit2 size={20} color="var(--text-primary)" />
                                    </div>
                                    <span style={{fontSize: '12px', color: 'var(--text-secondary)'}}>Biệt danh</span>
                                </div>
                                <div className="details-action-btn" onClick={handleMuteUser} style={{display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'pointer', gap: '8px'}}>
                                    <div style={{width: '36px', height: '36px', borderRadius: '50%', background: mutedUsers.includes(selectedFriend.Id) ? 'rgba(239, 68, 68, 0.2)' : 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.3s'}}>
                                        <BellOff size={20} color={mutedUsers.includes(selectedFriend.Id) ? '#ef4444' : 'var(--text-primary)'} />
                                    </div>
                                    <span style={{fontSize: '12px', color: mutedUsers.includes(selectedFriend.Id) ? '#ef4444' : 'var(--text-secondary)'}}>{mutedUsers.includes(selectedFriend.Id) ? 'Bật thông báo' : 'Tắt thông báo'}</span>
                                </div>
                                <div className="details-action-btn" onClick={() => { setShowSearchMessages(!showSearchMessages); if (showSearchMessages) setSearchMessageTerm(''); }} style={{display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'pointer', gap: '8px'}}>
                                    <div style={{width: '36px', height: '36px', borderRadius: '50%', background: showSearchMessages ? 'rgba(34, 197, 94, 0.2)' : 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.3s'}}>
                                        <Search size={20} color={showSearchMessages ? '#22c55e' : 'var(--text-primary)'} />
                                    </div>
                                    <span style={{fontSize: '12px', color: showSearchMessages ? '#22c55e' : 'var(--text-secondary)'}}>Tìm kiếm</span>
                                </div>
                            </div>
                        </div>

                        <div className="details-accordion-menu" style={{display: 'flex', flexDirection: 'column'}}>
                            <div className="details-section-header" style={{display: 'flex', justifyContent: 'space-between', padding: '12px 16px', cursor: 'pointer', borderRadius: '8px', margin: '0 8px'}} onMouseOver={e => e.currentTarget.style.background='rgba(255,255,255,0.05)'} onMouseOut={e => e.currentTarget.style.background='transparent'}>
                                <span style={{fontWeight: '600', fontSize: '14px', color: 'var(--text-primary)'}}>Thông tin về đoạn chat</span>
                                <ChevronDown size={20} color="var(--text-secondary)" />
                            </div>
                            <div className="details-section-header" style={{display: 'flex', justifyContent: 'space-between', padding: '12px 16px', cursor: 'pointer', borderRadius: '8px', margin: '0 8px'}} onMouseOver={e => e.currentTarget.style.background='rgba(255,255,255,0.05)'} onMouseOut={e => e.currentTarget.style.background='transparent'}>
                                <span style={{fontWeight: '600', fontSize: '14px', color: 'var(--text-primary)'}}>Tùy chỉnh đoạn chat</span>
                                <ChevronDown size={20} color="var(--text-secondary)" />
                            </div>
                            <div className="details-section-header" style={{display: 'flex', justifyContent: 'space-between', padding: '12px 16px', cursor: 'pointer', borderRadius: '8px', margin: '0 8px'}} onMouseOver={e => e.currentTarget.style.background='rgba(255,255,255,0.05)'} onMouseOut={e => e.currentTarget.style.background='transparent'} onClick={() => {
                                const el = document.getElementById('media-options');
                                el.style.display = el.style.display === 'none' ? 'block' : 'none';
                            }}>
                                <span style={{fontWeight: '600', fontSize: '14px', color: 'var(--text-primary)'}}>File phương tiện, file và liên kết</span>
                                <ChevronDown size={20} color="var(--text-secondary)" />
                            </div>
                            <div id="media-options" style={{display: 'none', padding: '0 8px'}}>
                                <div className="details-section" style={{marginBottom: 0, borderBottom: 'none'}}>
                                    <div className="details-section-header">
                                        <h4>Shared Media</h4>
                                        <span>{getText("viewAll")} <ChevronRight size={14} /></span>
                                    </div>
                                    <div className="shared-media-grid">
                                        {messages.filter(m => m.ImageUrl).slice(-6).map((m, i) => (
                                            <div key={i} className="media-item" style={{ overflow: 'hidden', padding: 0 }}>
                                                <img src={m.ImageUrl.startsWith('http') ? m.ImageUrl : `${m.ImageUrl}`} alt="media" style={{width: '100%', height: '100%', objectFit: 'cover'}} />
                                            </div>
                                        ))}
                                        {messages.filter(m => m.ImageUrl).length === 0 && (
                                            <p style={{fontSize: '12px', color: 'var(--text-secondary)', gridColumn: 'span 3', textAlign: 'center'}}>No media shared</p>
                                        )}
                                    </div>
                                </div>
        
                                <div className="details-section" style={{marginBottom: 0, borderBottom: 'none'}}>
                                    <div className="details-section-header">
                                        <h4>Shared Files</h4>
                                        <span>View all <ChevronRight size={14} /></span>
                                    </div>
                                    {messages.filter(m => m.AttachmentUrl && !m.AttachmentUrl.endsWith('.webm')).slice(-3).map((m, i) => (
                                        <a key={i} href={m.AttachmentUrl.startsWith('http') ? m.AttachmentUrl : `${m.AttachmentUrl}`} target="_blank" rel="noopener noreferrer" style={{textDecoration: 'none', color: 'inherit'}}>
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
        
                                <div className="details-section" style={{marginBottom: 0, borderBottom: 'none'}}>
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
                            </div>
                            <div className="details-section-header" style={{display: 'flex', justifyContent: 'space-between', padding: '12px 16px', cursor: 'pointer', borderRadius: '8px', margin: '0 8px'}} onMouseOver={e => e.currentTarget.style.background='rgba(255,255,255,0.05)'} onMouseOut={e => e.currentTarget.style.background='transparent'} onClick={() => {
                                const el = document.getElementById('privacy-options');
                                el.style.display = el.style.display === 'none' ? 'block' : 'none';
                            }}>
                                <span style={{fontWeight: '600', fontSize: '14px', color: 'var(--text-primary)'}}>Quyền riêng tư & hỗ trợ</span>
                                <ChevronDown size={20} color="var(--text-secondary)" />
                            </div>
                            <div id="privacy-options" style={{display: 'block', padding: '0 16px'}}>
                                <div className="details-menu-item" onClick={handleArchiveChat}>
                                    <Archive size={18} /> 
                                    <span>{selectedFriend.IsArchived ? 'Bỏ lưu trữ đoạn chat' : 'Lưu trữ đoạn chat'}</span>
                                </div>
                                <div className="details-menu-item" style={{color: '#ef4444'}} onClick={handleBlockUser}>
                                    <Ban size={18} /> <span>{getText("blockUser")}</span>
                                </div>
                                <div className="details-menu-item" style={{color: '#ef4444'}} onClick={handleDeleteChat}>
                                    <Trash2 size={18} /> <span>{getText("deleteChat")}</span>
                                </div>
                            </div>
                        </div>
                    </aside>
                )}

                {/* MODALS */}
                {incomingCall && !callActive && (
                    <div style={{position: 'fixed', top: '20px', left: '50%', transform: 'translateX(-50%)', background: 'var(--glass-bg)', border: '1px solid var(--glass-border)', padding: '16px 24px', borderRadius: '16px', zIndex: 1000, display: 'flex', alignItems: 'center', gap: '16px', backdropFilter: 'blur(10px)', color: 'white'}}>
                        <div className="chat-avatar" style={{width: '40px', height: '40px', background: 'var(--primary-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%'}}><UserIcon size={20}/></div>
                        <div>
                            <h4 style={{margin: 0}}>{incomingCall.callerName} is {incomingCall.isVideo ? 'video calling' : 'audio calling'}...</h4>
                        </div>
                        <div style={{display: 'flex', gap: '8px'}}>
                            <button style={{background: '#22c55e', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer'}} onClick={acceptCall}>Accept</button>
                            <button style={{background: '#ef4444', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer'}} onClick={() => { 
                                if(incomingCall && incomingCall.call) {
                                    socket.emit('rejectCall', { receiverId: incomingCall.call.peer });
                                    incomingCall.call.close(); 
                                }
                                setIncomingCall(null); 
                            }}>Decline</button>
                        </div>
                    </div>
                )}
                
                {callActive && (
                    <div style={{position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', background: 'var(--glass-bg)', border: '1px solid var(--glass-border)', padding: '24px', borderRadius: '16px', zIndex: 1000, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', backdropFilter: 'blur(10px)', color: 'white', minWidth: '400px'}}>
                        <h3>{callIsVideo ? getText('videoCall') : getText('audioCall')}</h3>
                        
                        {callIsVideo ? (
                            <div style={{display: 'flex', gap: '16px', width: '100%', justifyContent: 'center'}}>
                                <div style={{position: 'relative', width: '150px', height: '150px', background: 'black', borderRadius: '8px', overflow: 'hidden'}}>
                                    <video playsInline muted ref={myVideoRef} autoPlay style={{width: '100%', height: '100%', objectFit: 'cover'}} />
                                    <div style={{position: 'absolute', bottom: 4, left: 4, fontSize: '12px', background: 'rgba(0,0,0,0.5)', padding: '2px 4px', borderRadius: '4px'}}>{getText('you')}</div>
                                </div>
                                <div style={{position: 'relative', width: '200px', height: '150px', background: 'black', borderRadius: '8px', overflow: 'hidden'}}>
                                    {remoteStream ? (
                                        <video playsInline ref={remoteVideoRef} autoPlay style={{width: '100%', height: '100%', objectFit: 'cover'}} />
                                    ) : (
                                        <div style={{display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%'}}>Connecting...</div>
                                    )}
                                </div>
                            </div>
                        ) : (
                            <div style={{display: 'flex', gap: '32px', width: '100%', justifyContent: 'center', alignItems: 'center', margin: '20px 0'}}>
                                <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px'}}>
                                    <div style={{width: '80px', height: '80px', borderRadius: '50%', background: 'var(--primary-color)', display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
                                        <UserIcon size={40} />
                                    </div>
                                    <span>{getText('you')}</span>
                                    <video playsInline muted ref={myVideoRef} autoPlay style={{position: 'absolute', width: 0, height: 0, opacity: 0, pointerEvents: 'none'}} />
                                </div>
                                
                                <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px'}}>
                                    <div style={{width: '80px', height: '80px', borderRadius: '50%', background: '#4b5563', display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
                                        {remoteStream ? <UserIcon size={40} /> : <div style={{fontSize: '14px'}}>...</div>}
                                    </div>
                                    <span>{selectedFriend?.Username || 'Friend'}</span>
                                    {remoteStream && <video playsInline ref={remoteVideoRef} autoPlay style={{position: 'absolute', width: 0, height: 0, opacity: 0, pointerEvents: 'none'}} />}
                                </div>
                            </div>
                        )}
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
                    <div className="modal-content" onClick={e => e.stopPropagation()} style={{background: 'var(--glass-bg)', padding: '32px', borderRadius: '24px', width: '500px', maxHeight: '90vh', overflowY: 'auto', border: '1px solid var(--glass-border)', boxShadow: '0 8px 32px rgba(0,0,0,0.2)'}}>
                        <h2 style={{marginTop: 0, marginBottom: '24px', color: 'var(--text-primary)', fontSize: '24px', textAlign: 'center'}}>Chỉnh sửa hồ sơ</h2>
                        
                        {editProfileError && <div style={{background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', padding: '12px', borderRadius: '8px', marginBottom: '20px', textAlign: 'center', fontSize: '14px', border: '1px solid rgba(239, 68, 68, 0.3)'}}>{editProfileError}</div>}

                        <div style={{marginBottom: '16px'}}>
                            <label style={{display: 'block', marginBottom: '8px', color: 'var(--text-secondary)', fontSize: '15px', fontWeight: '500'}}>Username</label>
                            <input 
                                type="text" 
                                value={editProfileData.Username} 
                                onChange={e => setEditProfileData({...editProfileData, Username: e.target.value})}
                                style={{width: '100%', padding: '12px', borderRadius: '12px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--glass-border)', color: 'var(--text-primary)', outline: 'none', fontSize: '15px'}}
                                placeholder="Nhập username của bạn..."
                            />
                        </div>

                        <div style={{marginBottom: '16px'}}>
                            <label style={{display: 'block', marginBottom: '8px', color: 'var(--text-secondary)', fontSize: '15px', fontWeight: '500'}}>Email</label>
                            <input 
                                type="email" 
                                value={editProfileData.Email} 
                                onChange={e => setEditProfileData({...editProfileData, Email: e.target.value})}
                                style={{width: '100%', padding: '12px', borderRadius: '12px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--glass-border)', color: 'var(--text-primary)', outline: 'none', fontSize: '15px'}}
                                placeholder="Nhập email của bạn..."
                            />
                        </div>

                        <div style={{marginBottom: '16px'}}>
                            <label style={{display: 'block', marginBottom: '8px', color: 'var(--text-secondary)', fontSize: '15px', fontWeight: '500'}}>Họ và tên</label>
                            <input 
                                type="text" 
                                value={editProfileData.FullName} 
                                onChange={e => setEditProfileData({...editProfileData, FullName: e.target.value})}
                                style={{width: '100%', padding: '12px', borderRadius: '12px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--glass-border)', color: 'var(--text-primary)', outline: 'none', fontSize: '15px'}}
                                placeholder="Nhập họ và tên của bạn..."
                            />
                        </div>

                        <div style={{marginBottom: '16px'}}>
                            <label style={{display: 'block', marginBottom: '8px', color: 'var(--text-secondary)', fontSize: '15px', fontWeight: '500'}}>Ngày sinh</label>
                            <input 
                                type="date" 
                                value={editProfileData.DateOfBirth} 
                                onChange={e => setEditProfileData({...editProfileData, DateOfBirth: e.target.value})}
                                style={{width: '100%', padding: '12px', borderRadius: '12px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--glass-border)', color: 'var(--text-primary)', outline: 'none', fontSize: '15px'}}
                            />
                        </div>

                        <div style={{marginBottom: '20px'}}>
                            <label style={{display: 'block', marginBottom: '8px', color: 'var(--text-secondary)', fontSize: '15px', fontWeight: '500'}}>Tiểu sử</label>
                            <textarea 
                                value={editProfileData.Bio} 
                                onChange={e => setEditProfileData({...editProfileData, Bio: e.target.value})}
                                rows={3}
                                style={{width: '100%', padding: '12px', borderRadius: '12px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--glass-border)', color: 'var(--text-primary)', outline: 'none', resize: 'vertical', fontSize: '15px'}}
                                placeholder="Viết vài dòng giới thiệu về bản thân..."
                            />
                        </div>

                        {((editProfileData.Username !== (user.Username || '')) || (editProfileData.Email !== (user.Email || ''))) && (
                            <div style={{marginBottom: '24px', padding: '16px', borderRadius: '12px', background: 'rgba(239, 68, 68, 0.05)', border: '1px solid rgba(239, 68, 68, 0.2)'}}>
                                <label style={{display: 'block', marginBottom: '8px', color: '#ef4444', fontSize: '15px', fontWeight: 'bold'}}>Xác nhận mật khẩu</label>
                                <div style={{fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '12px'}}>Bạn cần nhập mật khẩu hiện tại để thay đổi Username hoặc Email.</div>
                                <input 
                                    type="password" 
                                    value={editProfileData.Password} 
                                    onChange={e => setEditProfileData({...editProfileData, Password: e.target.value})} 
                                    placeholder="Nhập mật khẩu..." 
                                    style={{width: '100%', padding: '12px', borderRadius: '12px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(239, 68, 68, 0.4)', color: 'var(--text-primary)', outline: 'none', fontSize: '15px'}} 
                                />
                            </div>
                        )}

                        <div style={{display: 'flex', gap: '16px', justifyContent: 'flex-end'}}>
                            <button onClick={() => setIsEditingProfile(false)} style={{padding: '12px 24px', borderRadius: '12px', background: 'transparent', border: '1px solid var(--glass-border)', color: 'var(--text-primary)', cursor: 'pointer', fontSize: '15px'}}>Hủy</button>
                            <button onClick={handleSaveProfile} style={{padding: '12px 24px', borderRadius: '12px', background: 'var(--primary-color)', border: 'none', color: 'white', cursor: 'pointer', fontWeight: 'bold', fontSize: '15px'}}>Lưu thay đổi</button>
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

            {/* Blocked Users Modal */}
            {showBlockedModal && (
                <div className="modal-overlay" onClick={() => setShowBlockedModal(false)} style={{position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
                    <div className="modal-content settings-modal-content" onClick={e => e.stopPropagation()}>
                        <div className="settings-modal-header" style={{display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px', borderBottom: '1px solid var(--glass-border)', position: 'relative'}}>
                            <h2 style={{margin: 0, fontSize: '18px', fontWeight: 'bold'}}>Danh sách chặn</h2>
                            <button onClick={() => setShowBlockedModal(false)} style={{position: 'absolute', right: '16px', background: 'rgba(255,255,255,0.1)', border: 'none', width: '32px', height: '32px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-primary)', cursor: 'pointer'}}>
                                <X size={20} />
                            </button>
                        </div>
                        <div className="settings-modal-body" style={{padding: '24px', overflowY: 'auto', maxHeight: '70vh'}}>
                            {(() => {
                                const blockedUsers = friendsList.filter(f => f.Status === 'blocked' && String(f.RequesterId) === String(user.Id));
                                if (blockedUsers.length === 0) return <div style={{color: 'var(--text-secondary)', fontSize: '14px', textAlign: 'center', marginTop: '20px'}}>Bạn chưa chặn ai cả.</div>;
                                return (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                        {blockedUsers.map(blocked => (
                                            <div key={blocked.Id} style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px', background: 'rgba(255,255,255,0.05)', borderRadius: '12px'}}>
                                                <div style={{display: 'flex', alignItems: 'center', gap: '12px'}}>
                                                    <div style={{width: '40px', height: '40px', borderRadius: '50%', background: 'var(--glass-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden'}}>
                                                        {blocked.AvatarUrl ? <img src={`${blocked.AvatarUrl}`} alt="Avatar" style={{width: '100%', height: '100%', objectFit: 'cover'}}/> : <UserIcon size={20} />}
                                                    </div>
                                                    <span style={{fontSize: '15px', fontWeight: '500'}}>{blocked.Nickname || blocked.FullName || blocked.Username}</span>
                                                </div>
                                                <button onClick={() => unblockUser(blocked.Id)} style={{background: 'rgba(255,255,255,0.1)', border: '1px solid var(--glass-border)', borderRadius: '8px', padding: '6px 16px', cursor: 'pointer', color: 'var(--text-primary)', fontSize: '13px', transition: 'all 0.2s'}}>
                                                    Bỏ chặn
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                );
                            })()}
                        </div>
                    </div>
                </div>
            )}

            {/* Friend Profile Modal */}
            {showFriendProfileModal && selectedFriend && (
                <div className="modal-overlay" onClick={() => setShowFriendProfileModal(false)} style={{position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
                    <div className="modal-content settings-modal-content" onClick={e => e.stopPropagation()} style={{padding: '32px', textAlign: 'center', maxWidth: '400px', width: '90%', background: 'var(--glass-bg)', borderRadius: '24px', border: '1px solid var(--glass-border)', boxShadow: '0 8px 32px rgba(0,0,0,0.2)'}}>
                        <div style={{display: 'flex', justifyContent: 'flex-end'}}>
                            <button onClick={() => setShowFriendProfileModal(false)} style={{background: 'rgba(255,255,255,0.1)', border: 'none', width: '32px', height: '32px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-primary)', cursor: 'pointer'}}>
                                <X size={20} />
                            </button>
                        </div>
                        <div style={{width: '96px', height: '96px', margin: '0 auto 16px', background: 'var(--primary-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', color: 'white', overflow: 'hidden'}}>
                            {selectedFriend.AvatarUrl ? <img src={`${selectedFriend.AvatarUrl}`} alt="Avatar" style={{width: '100%', height: '100%', objectFit: 'cover'}}/> : <UserIcon size={48} />}
                        </div>
                        <h2 style={{margin: '0 0 8px', fontSize: '24px', fontWeight: 'bold'}}>{selectedFriend.Nickname || selectedFriend.FullName || selectedFriend.Username}</h2>
                        <p style={{margin: '0 0 24px', color: 'var(--text-secondary)', fontSize: '15px'}}>{selectedFriend.Bio || 'Chưa có tiểu sử.'}</p>
                        
                        <div style={{background: 'rgba(255,255,255,0.05)', borderRadius: '12px', padding: '16px', textAlign: 'left'}}>
                            <div style={{marginBottom: '12px'}}>
                                <div style={{fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '4px'}}>Username</div>
                                <div style={{fontSize: '15px', fontWeight: '500'}}>{selectedFriend.Username}</div>
                            </div>
                            {selectedFriend.Email && (
                                <div style={{marginBottom: '12px'}}>
                                    <div style={{fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '4px'}}>Email</div>
                                    <div style={{fontSize: '15px', fontWeight: '500'}}>{selectedFriend.Email}</div>
                                </div>
                            )}
                            {selectedFriend.DateOfBirth && (
                                <div>
                                    <div style={{fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '4px'}}>Ngày sinh</div>
                                    <div style={{fontSize: '15px', fontWeight: '500'}}>{new Date(selectedFriend.DateOfBirth).toLocaleDateString()}</div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Nickname Modal */}
            {showNicknameModal && selectedFriend && (
                <div className="modal-overlay" onClick={() => setShowNicknameModal(false)} style={{position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
                    <div className="modal-content settings-modal-content" onClick={e => e.stopPropagation()} style={{padding: '32px', textAlign: 'center', maxWidth: '400px', width: '90%', background: 'var(--glass-bg)', borderRadius: '24px', border: '1px solid var(--glass-border)', boxShadow: '0 8px 32px rgba(0,0,0,0.2)'}}>
                        <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px'}}>
                            <h2 style={{margin: 0, fontSize: '18px', fontWeight: 'bold'}}>Đặt biệt danh</h2>
                            <button onClick={() => setShowNicknameModal(false)} style={{background: 'rgba(255,255,255,0.1)', border: 'none', width: '32px', height: '32px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-primary)', cursor: 'pointer'}}>
                                <X size={20} />
                            </button>
                        </div>
                        <div style={{textAlign: 'left', marginBottom: '24px'}}>
                            <p style={{fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '16px'}}>Tên này sẽ chỉ hiển thị với bạn. Bạn có thể thay đổi hoặc xóa nó bất cứ lúc nào.</p>
                            <input 
                                type="text"
                                value={nickname}
                                onChange={e => setNickname(e.target.value)}
                                placeholder={selectedFriend.FullName || selectedFriend.Username}
                                style={{width: '100%', padding: '12px 16px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--glass-border)', borderRadius: '12px', color: 'var(--text-primary)', fontSize: '15px', outline: 'none'}}
                                autoFocus
                            />
                        </div>
                        <div style={{display: 'flex', gap: '12px', justifyContent: 'flex-end'}}>
                            <button onClick={() => setShowNicknameModal(false)} style={{padding: '10px 20px', borderRadius: '12px', border: 'none', background: 'rgba(255,255,255,0.1)', color: 'var(--text-primary)', cursor: 'pointer', fontWeight: '500'}}>Hủy</button>
                            <button onClick={handleSetNickname} style={{padding: '10px 20px', borderRadius: '12px', border: 'none', background: 'var(--primary-color)', color: 'white', cursor: 'pointer', fontWeight: '500'}}>Lưu</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Policy Modal */}
            {showPolicyModal && (
                <div className="modal-overlay" onClick={() => setShowPolicyModal(false)} style={{position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
                    <div className="modal-content settings-modal-content" onClick={e => e.stopPropagation()}>
                        <div className="settings-modal-header" style={{display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px', borderBottom: '1px solid var(--glass-border)', position: 'relative'}}>
                            <h2 style={{margin: 0, fontSize: '18px', fontWeight: 'bold'}}>
                                {policyType === 'privacy' ? 'Chính sách quyền riêng tư' : policyType === 'terms' ? 'Điều khoản sử dụng' : 'Chính sách về cookie'}
                            </h2>
                            <button onClick={() => setShowPolicyModal(false)} style={{position: 'absolute', right: '16px', background: 'rgba(255,255,255,0.1)', border: 'none', width: '32px', height: '32px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-primary)', cursor: 'pointer'}}>
                                <X size={20} />
                            </button>
                        </div>
                        <div className="settings-modal-body" style={{padding: '24px', overflowY: 'auto', maxHeight: '70vh', lineHeight: '1.6'}}>
                            {policyType === 'privacy' && (
                                <div>
                                    <h3 style={{marginBottom: '8px', marginTop: '0'}}>Bảo vệ Dữ liệu Của Bạn</h3>
                                    <p style={{marginBottom: '16px', color: 'var(--text-secondary)'}}>Chúng tôi coi trọng quyền riêng tư của bạn. Dữ liệu cá nhân bao gồm thông tin đăng nhập, tin nhắn và danh sách bạn bè được mã hóa và bảo vệ an toàn.</p>
                                    <h3 style={{marginBottom: '8px'}}>Thu Thập Thông Tin</h3>
                                    <p style={{marginBottom: '16px', color: 'var(--text-secondary)'}}>Chúng tôi chỉ thu thập thông tin cần thiết để cung cấp dịch vụ nhắn tin, bao gồm địa chỉ email để khôi phục mật khẩu và tên hiển thị.</p>
                                    <h3 style={{marginBottom: '8px'}}>Chia Sẻ Dữ Liệu</h3>
                                    <p style={{marginBottom: '0', color: 'var(--text-secondary)'}}>VibeChat cam kết không chia sẻ dữ liệu của bạn cho bất kỳ bên thứ ba nào vì mục đích quảng cáo hoặc thương mại.</p>
                                </div>
                            )}
                            {policyType === 'terms' && (
                                <div>
                                    <h3 style={{marginBottom: '8px', marginTop: '0'}}>Chấp Nhận Điều Khoản</h3>
                                    <p style={{marginBottom: '16px', color: 'var(--text-secondary)'}}>Bằng việc sử dụng VibeChat, bạn đồng ý tuân thủ các quy định về hành vi chuẩn mực trên không gian mạng.</p>
                                    <h3 style={{marginBottom: '8px'}}>Hành Vi Bị Cấm</h3>
                                    <p style={{marginBottom: '16px', color: 'var(--text-secondary)'}}>Nghiêm cấm mọi hành vi gửi tin nhắn quấy rối, đe dọa, phát tán mã độc hoặc nội dung vi phạm pháp luật.</p>
                                    <h3 style={{marginBottom: '8px'}}>Chấm Dứt Sử Dụng</h3>
                                    <p style={{marginBottom: '0', color: 'var(--text-secondary)'}}>Chúng tôi có quyền vô hiệu hóa tài khoản của bạn nếu phát hiện vi phạm nghiêm trọng các điều khoản này.</p>
                                </div>
                            )}
                            {policyType === 'cookie' && (
                                <div>
                                    <h3 style={{marginBottom: '8px', marginTop: '0'}}>Sử Dụng Cookie</h3>
                                    <p style={{marginBottom: '16px', color: 'var(--text-secondary)'}}>VibeChat sử dụng các phiên (sessions) và local storage (như localStorage) để duy trì trạng thái đăng nhập và các cài đặt cá nhân (chế độ tối, ngôn ngữ).</p>
                                    <h3 style={{marginBottom: '8px'}}>Kiểm Soát Dữ Liệu</h3>
                                    <p style={{marginBottom: '0', color: 'var(--text-secondary)'}}>Bạn có thể xóa toàn bộ dữ liệu này bằng cách Đăng xuất hoặc xóa dữ liệu duyệt web trong trình duyệt của mình.</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Settings Modal (Tùy chọn) */}
            {showSettingsModal && (
                <div className="modal-overlay" onClick={() => setShowSettingsModal(false)} style={{position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
                    <div className="modal-content settings-modal-content" onClick={e => e.stopPropagation()}>
                        <div className="settings-modal-header" style={{display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px', borderBottom: '1px solid var(--glass-border)', position: 'relative'}}>
                            <h2 style={{margin: 0, fontSize: '18px', fontWeight: 'bold'}}>Tùy chọn</h2>
                            <button onClick={() => setShowSettingsModal(false)} style={{position: 'absolute', right: '16px', background: 'rgba(255,255,255,0.1)', border: 'none', width: '32px', height: '32px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-primary)', cursor: 'pointer'}}>
                                <X size={20} />
                            </button>
                        </div>
                        
                        <div className="settings-modal-body" style={{padding: '16px', overflowY: 'auto', maxHeight: '70vh'}}>
                            {/* Tài khoản */}
                            <div className="settings-section">
                                <h3 className="settings-section-title">Tài khoản</h3>
                                <div className="settings-account-info" onClick={() => setShowAccountDetails(!showAccountDetails)} style={{display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 0', cursor: 'pointer'}}>
                                    <div style={{width: '40px', height: '40px', borderRadius: '50%', overflow: 'hidden', background: 'var(--primary-color)', display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
                                        {user.AvatarUrl ? <img src={`${user.AvatarUrl}`} alt="Avatar" style={{width: '100%', height: '100%', objectFit: 'cover'}}/> : <UserIcon size={24} color="white"/>}
                                    </div>
                                    <div style={{flex: 1}}>
                                        <div style={{fontWeight: 'bold', fontSize: '16px'}}>{user.FullName || user.Username}</div>
                                        <div style={{color: 'var(--text-secondary)', fontSize: '13px'}}>{showAccountDetails ? 'Ẩn thông tin' : 'Xem thông tin tài khoản'}</div>
                                    </div>
                                </div>
                                {showAccountDetails && (
                                    <div style={{padding: '12px', background: 'rgba(255,255,255,0.05)', borderRadius: '8px', marginTop: '8px'}}>
                                        <div style={{display: 'flex', flexDirection: 'column', gap: '8px'}}>
                                            <div><span style={{color: 'var(--text-secondary)', fontSize: '13px'}}>Username:</span> <br/> <strong>{user.Username}</strong></div>
                                            <div><span style={{color: 'var(--text-secondary)', fontSize: '13px'}}>Tên đầy đủ:</span> <br/> <strong>{user.FullName || 'Chưa cập nhật'}</strong></div>
                                            <div><span style={{color: 'var(--text-secondary)', fontSize: '13px'}}>Email:</span> <br/> <strong>{user.Email || 'Chưa cập nhật'}</strong></div>
                                            <div><span style={{color: 'var(--text-secondary)', fontSize: '13px'}}>Ngày sinh:</span> <br/> <strong>{user.DateOfBirth ? new Date(user.DateOfBirth).toLocaleDateString() : 'Chưa cập nhật'}</strong></div>
                                        </div>
                                        <button onClick={() => { setShowSettingsModal(false); setEditProfileData({ FullName: user.FullName || '', Bio: user.Bio || '', Username: user.Username || '', Email: user.Email || '', DateOfBirth: user.DateOfBirth ? user.DateOfBirth.split('T')[0] : '', Password: '' }); setEditProfileError(''); setIsEditingProfile(true); }} style={{marginTop: '12px', background: 'var(--primary-color)', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: 'bold', width: '100%'}}>
                                            Chỉnh sửa hồ sơ
                                        </button>
                                    </div>
                                )}
                            </div>
                            
                            <hr className="settings-divider" />

                            {/* Trạng thái hoạt động */}
                            <div className="settings-section" style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0'}}>
                                <div style={{display: 'flex', alignItems: 'center', gap: '12px'}}>
                                    <Circle size={20} />
                                    <span style={{fontWeight: '500'}}>Trạng thái hoạt động: {showStatus ? 'ĐANG BẬT' : 'ĐANG TẮT'}</span>
                                </div>
                                <label className="toggle-switch">
                                    <input type="checkbox" checked={showStatus} onChange={(e) => setShowStatus(e.target.checked)} />
                                    <span className="slider"></span>
                                </label>
                            </div>

                            <hr className="settings-divider" />

                            {/* Thông báo */}
                            <div className="settings-section">
                                <h3 className="settings-section-title">Thông báo</h3>
                                <div style={{display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', padding: '12px 0'}}>
                                    <div style={{display: 'flex', alignItems: 'flex-start', gap: '12px'}}>
                                        <Bell size={20} style={{marginTop: '4px'}} />
                                        <div>
                                            <div style={{fontWeight: '500', marginBottom: '4px'}}>Âm thanh thông báo</div>
                                            <div style={{color: 'var(--text-secondary)', fontSize: '13px', lineHeight: '1.4'}}>Dùng thông báo bằng âm thanh để biết về tin nhắn, cuộc gọi đến.</div>
                                        </div>
                                    </div>
                                    <label className="toggle-switch">
                                        <input type="checkbox" checked={soundEnabled} onChange={(e) => setSoundEnabled(e.target.checked)} />
                                        <span className="slider"></span>
                                    </label>
                                </div>
                            </div>

                            <hr className="settings-divider" />

                            {/* Chế độ tối */}
                            <div className="settings-section">
                                <div style={{display: 'flex', alignItems: 'flex-start', gap: '12px', padding: '12px 0'}}>
                                    <Moon size={20} style={{marginTop: '4px'}} />
                                    <div style={{flex: 1}}>
                                        <div style={{fontWeight: '500', marginBottom: '4px'}}>Chế độ tối</div>
                                        <div style={{color: 'var(--text-secondary)', fontSize: '13px', lineHeight: '1.4', marginBottom: '16px'}}>Điều chỉnh giao diện của VibeChat để giảm độ chói và cho đôi mắt được nghỉ ngơi.</div>
                                        
                                        <div className="radio-group" style={{display: 'flex', flexDirection: 'column', gap: '16px'}}>
                                            <label style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer'}}>
                                                <span>Tắt</span>
                                                <input type="radio" name="darkmode" checked={!isDarkMode} onChange={() => setIsDarkMode(false)} className="custom-radio" />
                                            </label>
                                            <label style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer'}}>
                                                <span>Bật</span>
                                                <input type="radio" name="darkmode" checked={isDarkMode} onChange={() => setIsDarkMode(true)} className="custom-radio" />
                                            </label>
                                        </div>
                                    </div>
                                </div>
                            </div>



                            {/* Language */}
                            <div className="settings-section" style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0'}}>
                                <div style={{display: 'flex', alignItems: 'center', gap: '12px'}}>
                                    <Settings size={20} />
                                    <span style={{fontWeight: '500'}}>Ngôn ngữ / Language</span>
                                </div>
                                <select 
                                    value={language} 
                                    onChange={(e) => setLanguage(e.target.value)}
                                    style={{background: 'rgba(255,255,255,0.1)', border: '1px solid var(--glass-border)', color: 'var(--text-primary)', padding: '6px 12px', borderRadius: '8px', outline: 'none'}}
                                >
                                    <option value="English">English</option>
                                    <option value="Vietnamese">Vietnamese</option>
                                    <option value="Japanese">Japanese</option>
                                </select>
                            </div>
                            
                            <hr className="settings-divider" />

                            {/* Change password button inside settings */}
                            <div className="settings-section" style={{padding: '12px 0'}}>
                                <button className="btn-primary" style={{width: '100%', background: 'rgba(255,255,255,0.1)', border: '1px solid var(--glass-border)', color: 'var(--text-primary)', padding: '10px', borderRadius: '8px', cursor: 'pointer', fontWeight: '500'}} onClick={() => {setShowSettingsModal(false); setShowPasswordModal(true);}}>
                                    Đổi mật khẩu
                                </button>
                            </div>

                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Chat;
