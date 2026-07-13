import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { socket } from '../socket';
import { 
    LogOut, User as UserIcon, MessageSquare, Users, 
    Settings, Search, 
    Home, Video, Menu, CheckCheck, Phone, Paperclip, Folder, Smile, Bold, Code, List, Camera
} from 'lucide-react';
import EmojiPicker from 'emoji-picker-react';
import Peer from 'peerjs';
import './Chat.css';

const Chat = ({ user, setUser }) => {
    const [activeTab, setActiveTab] = useState('chats'); // 'chats', 'people', 'profile', 'settings'
    const [friendsList, setFriendsList] = useState([]);
    const [searchResults, setSearchResults] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [isDarkMode, setIsDarkMode] = useState(false);
    
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
    const [isCalling, setIsCalling] = useState(false);
    
    // WebRTC State
    const [peer, setPeer] = useState(null);
    const [myStream, setMyStream] = useState(null);
    const [remoteStream, setRemoteStream] = useState(null);
    const [callActive, setCallActive] = useState(false);
    
    // Change password state
    const [oldPassword, setOldPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [changePasswordMsg, setChangePasswordMsg] = useState('');
    
    const messagesEndRef = useRef(null);
    const typingTimeoutRef = useRef(null);
    const myVideoRef = useRef(null);
    const remoteVideoRef = useRef(null);
    const currentCallRef = useRef(null);
    const navigate = useNavigate();

    useEffect(() => {
        if (isDarkMode) {
            document.body.classList.add('dark-theme');
        } else {
            document.body.classList.remove('dark-theme');
        }
    }, [isDarkMode]);

    // Fetch friendships and tasks
    const fetchFriends = useCallback(async () => {
        if (!user) return;
        try {
            const response = await axios.get(`http://localhost:5000/api/friends/${user.Id}`);
            setFriendsList(response.data);
        } catch (err) {
            console.error("Failed to fetch friends", err);
        }
    }, [user]);

    const fetchTasks = useCallback(async () => {
        if (!user) return;
        try {
            const response = await axios.get('http://localhost:5000/api/tasks');
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
                if (searchQuery.trim().length > 0) {
                    try {
                        const response = await axios.get(`http://localhost:5000/api/users/search?q=${searchQuery}&currentUserId=${user.Id}`);
                        setSearchResults(response.data);
                    } catch (err) {
                        console.error(err);
                    }
                } else {
                    setSearchResults([]);
                }
            }, 300);
            return () => clearTimeout(delayDebounceFn);
        }
    }, [searchQuery, activeTab, user]);

    // Friend actions
    const sendFriendRequest = async (addresseeId) => {
        try {
            await axios.post('http://localhost:5000/api/friends/request', {
                requesterId: user.Id,
                addresseeId
            });
            setSearchQuery(prev => prev + ' '); 
            setSearchQuery(prev => prev.trim());
        } catch (err) {
            console.error(err);
        }
    };

    const acceptFriendRequest = async (requesterId) => {
        try {
            await axios.post('http://localhost:5000/api/friends/accept', {
                requesterId,
                addresseeId: user.Id
            });
            fetchFriends();
        } catch (err) {
            console.error(err);
        }
    };

    // Messages
    useEffect(() => {
        if (!selectedFriend || !user) return;
        const fetchMessages = async () => {
            try {
                const response = await axios.get(`http://localhost:5000/api/messages?user1=${user.Id}&user2=${selectedFriend.Id}`);
                setMessages(response.data);
            } catch (err) {
                console.error("Failed to fetch messages", err);
            }
        };
        fetchMessages();
    }, [selectedFriend, user]);

    useEffect(() => {
        setIsTyping(false);
    }, [selectedFriend]);

    const playNotificationSound = () => {
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
                selectedFriend && 
                ((message.SenderId === user.Id && message.ReceiverId === selectedFriend.Id) || 
                 (message.SenderId === selectedFriend.Id && message.ReceiverId === user.Id))
            ) {
                setMessages(prev => [...prev, message]);
                if (message.SenderId !== user.Id) playNotificationSound();
            } else if (message.SenderId !== user.Id) {
                playNotificationSound();
                setUnreadCounts(prev => ({
                    ...prev,
                    [message.SenderId]: (prev[message.SenderId] || 0) + 1
                }));
            }
        };

        const handleOnlineUsersList = (usersList) => setOnlineUsers(new Set(usersList));
        
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
        
        const handleTyping = ({ senderId }) => {
            if (selectedFriend && senderId === selectedFriend.Id) setIsTyping(true);
        };
        
        const handleStopTyping = ({ senderId }) => {
            if (selectedFriend && senderId === selectedFriend.Id) setIsTyping(false);
        };

        socket.on('receiveMessage', handleReceiveMessage);
        socket.on('onlineUsersList', handleOnlineUsersList);
        socket.on('userOnline', handleUserOnline);
        socket.on('userOffline', handleUserOffline);
        socket.on('typing', handleTyping);
        socket.on('stopTyping', handleStopTyping);

        return () => {
            socket.off('receiveMessage', handleReceiveMessage);
            socket.off('onlineUsersList', handleOnlineUsersList);
            socket.off('userOnline', handleUserOnline);
            socket.off('userOffline', handleUserOffline);
            socket.off('typing', handleTyping);
            socket.off('stopTyping', handleStopTyping);
        };
    }, [selectedFriend, user]);

    // PeerJS Init
    useEffect(() => {
        if (!user) return;
        const newPeer = new Peer(user.Id.toString());
        setPeer(newPeer);
        
        newPeer.on('call', (call) => {
            setIncomingCall({
                call,
                callerName: call.metadata?.callerName || 'Friend'
            });
        });
        
        return () => {
            newPeer.destroy();
        };
    }, [user]);

    // Set Video Src
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

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    const handleMessageChange = (e) => {
        setNewMessage(e.target.value);
        if (!selectedFriend) return;

        socket.emit('typing', { senderId: user.Id, receiverId: selectedFriend.Id });

        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);

        typingTimeoutRef.current = setTimeout(() => {
            socket.emit('stopTyping', { senderId: user.Id, receiverId: selectedFriend.Id });
        }, 1500);
    };

    const handleSendMessage = (e) => {
        e.preventDefault();
        if (!newMessage.trim() && !e.target.closest) return; // Allow sending if it's just an image
        
        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        socket.emit('stopTyping', { senderId: user.Id, receiverId: selectedFriend.Id });
        
        if (newMessage.trim()) {
            socket.emit('sendMessage', {
                senderId: user.Id,
                receiverId: selectedFriend.Id,
                content: newMessage,
                username: user.Username
            });
            setNewMessage('');
            setShowEmojiPicker(false);
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
            const response = await axios.post('http://localhost:5000/api/users/avatar', formData, {
                headers: {
                    'Content-Type': 'multipart/form-data'
                }
            });
            setUser(prev => ({ ...prev, AvatarUrl: response.data.avatarUrl }));
        } catch (err) {
            console.error('Failed to upload avatar:', err);
            alert('Failed to upload avatar');
        }
    };

    const handleImageUpload = async (e) => {
        const file = e.target.files[0];
        if (!file || !selectedFriend) return;

        const formData = new FormData();
        formData.append('image', file);

        try {
            const response = await axios.post('http://localhost:5000/api/messages/image', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            
            socket.emit('sendMessage', {
                senderId: user.Id,
                receiverId: selectedFriend.Id,
                content: 'Sent an image',
                imageUrl: response.data.imageUrl,
                username: user.Username
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
            const response = await axios.post('http://localhost:5000/api/messages/file', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            
            socket.emit('sendFileMessage', {
                senderId: user.Id,
                receiverId: selectedFriend.Id,
                content: `Sent a file`,
                attachmentUrl: response.data.fileUrl,
                username: user.Username
            });
        } catch (err) {
            console.error('Failed to upload document:', err);
            alert('Failed to upload document');
        }
    };

    const handleAddTask = async (e) => {
        if (e.key === 'Enter' && newTaskTitle.trim()) {
            try {
                const response = await axios.post('http://localhost:5000/api/tasks', { title: newTaskTitle });
                setTasks([response.data, ...tasks]);
                setNewTaskTitle('');
            } catch (err) {
                console.error(err);
            }
        }
    };

    const handleToggleTask = async (task) => {
        try {
            await axios.put(`http://localhost:5000/api/tasks/${task.Id}`, { isCompleted: !task.IsCompleted });
            setTasks(tasks.map(t => t.Id === task.Id ? { ...t, IsCompleted: !t.IsCompleted } : t));
        } catch (err) {
            console.error(err);
        }
    };

    const handleChangePassword = async (e) => {
        e.preventDefault();
        try {
            const res = await axios.post('http://localhost:5000/api/auth/change-password', { oldPassword, newPassword });
            setChangePasswordMsg(res.data.message);
            setOldPassword('');
            setNewPassword('');
        } catch (err) {
            setChangePasswordMsg(err.response?.data?.error || "Error");
        }
    };

    const initiateCall = async (isVideo) => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: isVideo, audio: true });
            setMyStream(stream);
            setCallActive(true);
            
            if (peer && selectedFriend) {
                const call = peer.call(selectedFriend.Id.toString(), stream, {
                    metadata: { callerName: user.Username }
                });
                
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
            const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
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

    const handleLogout = () => {
        socket.disconnect();
        localStorage.removeItem('token');
        delete axios.defaults.headers.common['Authorization'];
        setUser(null);
        navigate('/');
    };

    if (!user) return null;

    const activeFriends = friendsList.filter(f => f.Status === 'accepted');
    const pendingRequests = friendsList.filter(f => f.Status === 'pending' && f.AddresseeId === user.Id);

    const renderListPane = () => {
        if (activeTab === 'chats') {
            return (
                <>
                    <div className="chat-list-header">
                        <h2>Chat List</h2>
                        <div className="search-bar">
                            <Search size={18} className="search-icon" color="var(--text-secondary)" />
                            <input type="text" placeholder="Search" />
                        </div>
                        <div className="filter-dropdown">
                            <span>All Chats</span>
                            <Menu size={16} />
                        </div>
                    </div>
                    <div className="chat-items">
                        {activeFriends.length === 0 ? (
                            <div style={{color: 'var(--text-secondary)', padding: '16px'}}>No chats yet. Go to People to add some!</div>
                        ) : (
                            activeFriends.map(friend => (
                                <div 
                                    key={friend.Id} 
                                    className={`chat-item ${selectedFriend?.Id === friend.Id ? 'active' : ''}`}
                                    onClick={() => handleSelectFriend(friend)}
                                >
                                    <div style={{position: 'relative'}}>
                                        <div className="chat-avatar" style={{background: 'var(--primary-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', overflow: 'hidden'}}>
                                            {friend.AvatarUrl ? <img src={`http://localhost:5000${friend.AvatarUrl}`} alt="Avatar" style={{width: '100%', height: '100%', objectFit: 'cover'}}/> : <UserIcon size={24} />}
                                        </div>
                                        <div className="chat-status-dot" style={{ backgroundColor: onlineUsers.has(friend.Id) ? '#22c55e' : '#6b7280' }}></div>
                                    </div>
                                    <div className="chat-item-info">
                                        <div className="chat-item-top">
                                            <span className="chat-item-name">{friend.FullName || friend.Username}</span>
                                            <span className="chat-item-time">1:00 PM</span>
                                        </div>
                                        <div className="chat-item-snippet">
                                            Click to view messages
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
                        <h2>People</h2>
                        <div className="search-bar">
                            <Search size={18} className="search-icon" color="var(--text-secondary)" />
                            <input 
                                type="text" 
                                placeholder="Search users..." 
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
                                            {req.AvatarUrl ? <img src={`http://localhost:5000${req.AvatarUrl}`} alt="Avatar" style={{width: '100%', height: '100%', objectFit: 'cover'}}/> : <UserIcon size={24} />}
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
                            <h3 style={{fontSize: '12px', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '8px'}}>{searchQuery ? 'Results' : 'Suggested'}</h3>
                            {searchResults.length === 0 && searchQuery ? (
                                <div style={{color: 'var(--text-secondary)', padding: '8px'}}>No users found</div>
                            ) : (
                                searchResults.map(su => (
                                    <div key={su.Id} className="chat-item">
                                        <div className="chat-avatar" style={{background: 'var(--primary-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', overflow: 'hidden'}}>
                                            {su.AvatarUrl ? <img src={`http://localhost:5000${su.AvatarUrl}`} alt="Avatar" style={{width: '100%', height: '100%', objectFit: 'cover'}}/> : <UserIcon size={24} />}
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
                    <div className="chat-list-header">
                        <h2>Profile</h2>
                    </div>
                    <div className="profile-container">
                        <div className="profile-avatar-wrapper">
                            {user.AvatarUrl ? (
                                <img src={`http://localhost:5000${user.AvatarUrl}`} alt="Avatar" className="profile-avatar" />
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
                        <div className="profile-info">
                            <div className="profile-info-item">
                                <label>Username</label>
                                <p>{user.Username}</p>
                            </div>
                            <div className="profile-info-item">
                                <label>Full Name</label>
                                <p>{user.FullName || 'Not set'}</p>
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
                        <h2>Settings</h2>
                    </div>
                    <div className="chat-items" style={{padding: '0 8px'}}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px', background: 'rgba(255,255,255,0.05)', borderRadius: '12px', color: 'var(--text-primary)' }}>
                            <span style={{fontWeight: '500'}}>Dark Mode</span>
                            <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                                <input 
                                    type="checkbox" 
                                    checked={isDarkMode} 
                                    onChange={(e) => setIsDarkMode(e.target.checked)} 
                                    style={{ width: '18px', height: '18px', marginRight: '8px', cursor: 'pointer' }} 
                                />
                                <span style={{fontSize: '14px', color: 'var(--text-secondary)'}}>{isDarkMode ? 'On' : 'Off'}</span>
                            </label>
                        </div>
                        
                        <div style={{ marginTop: '16px', padding: '16px', background: 'rgba(255,255,255,0.05)', borderRadius: '12px', color: 'var(--text-primary)' }}>
                            <h3 style={{fontSize: '16px', marginBottom: '12px'}}>Change Password</h3>
                            <form onSubmit={handleChangePassword}>
                                <input type="password" placeholder="Old Password" style={{width: '100%', padding: '8px', marginBottom: '8px', borderRadius: '4px', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', color: 'white'}} value={oldPassword} onChange={e => setOldPassword(e.target.value)} />
                                <input type="password" placeholder="New Password" style={{width: '100%', padding: '8px', marginBottom: '8px', borderRadius: '4px', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', color: 'white'}} value={newPassword} onChange={e => setNewPassword(e.target.value)} />
                                <button type="submit" style={{padding: '8px 16px', borderRadius: '4px', background: 'var(--primary-color)', color: 'white', border: 'none', cursor: 'pointer'}}>Update</button>
                                {changePasswordMsg && <div style={{marginTop: '8px', fontSize: '12px', color: '#22c55e'}}>{changePasswordMsg}</div>}
                            </form>
                        </div>

                        <button className="btn-primary" style={{width: '100%', backgroundColor: '#ef4444', marginTop: '16px', color: 'white', border: 'none', padding: '12px', borderRadius: '12px', cursor: 'pointer', fontWeight: 'bold'}} onClick={handleLogout}>Log Out</button>
                    </div>
                </>
            );
        }

        if (activeTab === 'home') {
            return (
                <>
                    <div className="chat-list-header">
                        <h2>Home</h2>
                    </div>
                    <div className="chat-items" style={{padding: '16px', color: 'var(--text-secondary)'}}>
                        <p>Welcome to VibeChat!</p>
                        <p style={{marginTop: '8px'}}>Select Chats to start messaging, or People to find friends.</p>
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
                        {user.AvatarUrl ? <img src={`http://localhost:5000${user.AvatarUrl}`} alt="Avatar" style={{width: '100%', height: '100%', objectFit: 'cover'}}/> : <UserIcon size={24} />}
                        <div className="nav-status-dot"></div>
                    </div>
                    <div className="nav-items">
                        <button className={`nav-item ${activeTab === 'home' ? 'active' : ''}`} onClick={() => setActiveTab('home')} title="Home">
                            <Home size={24} />
                        </button>
                        <button className={`nav-item ${activeTab === 'chats' ? 'active' : ''}`} onClick={() => setActiveTab('chats')} title="Chats">
                            <MessageSquare size={24} />
                        </button>
                        <button className={`nav-item ${activeTab === 'people' ? 'active' : ''}`} onClick={() => setActiveTab('people')} title="People">
                            <Users size={24} />
                        </button>
                    </div>
                    <div className="nav-bottom">
                        <button className={`nav-item ${activeTab === 'settings' ? 'active' : ''}`} onClick={() => setActiveTab('settings')} title="Settings">
                            <Settings size={24} />
                        </button>
                        <button className="nav-item" onClick={handleLogout} title="Help">
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
                                        {selectedFriend.AvatarUrl ? <img src={`http://localhost:5000${selectedFriend.AvatarUrl}`} alt="Avatar" style={{width: '100%', height: '100%', objectFit: 'cover'}}/> : <UserIcon size={24} />}
                                    </div>
                                    <div className="header-user-text">
                                        <h3>{selectedFriend.FullName || selectedFriend.Username}</h3>
                                        <div className="header-user-status">
                                            <div className="chat-status-dot" style={{ backgroundColor: onlineUsers.has(selectedFriend.Id) ? '#22c55e' : '#6b7280', position: 'relative', border: 'none', width: '10px', height: '10px', marginRight: '6px' }}></div> 
                                            {onlineUsers.has(selectedFriend.Id) ? 'Online' : 'Offline'} 
                                            {isTyping && <span style={{marginLeft: '4px', fontStyle: 'italic', color: 'var(--primary-color)'}}>- Typing...</span>}
                                        </div>
                                    </div>
                                </div>
                                <div className="header-actions">
                                    <Video size={20} style={{cursor: 'pointer'}} onClick={() => initiateCall(true)} />
                                    <Phone size={20} style={{cursor: 'pointer'}} onClick={() => initiateCall(false)} />
                                    <Settings size={20} style={{cursor: 'pointer'}} />
                                </div>
                            </header>

                            <div className="messages-area">
                                {messages.length === 0 ? (
                                    <div style={{height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)'}}>
                                        <p>No messages yet. Say hi!</p>
                                    </div>
                                ) : (
                                    messages.map((msg, index) => {
                                        const isMine = msg.SenderId === user.Id;
                                        return (
                                            <div key={msg.Id || index} className={`message-wrapper ${isMine ? 'mine' : 'other'}`}>
                                                <div className="message-meta" style={{flexDirection: isMine ? 'row-reverse' : 'row'}}>
                                                    <div className="chat-avatar" style={{width: '24px', height: '24px', background: 'var(--primary-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', margin: 0, overflow: 'hidden'}}>
                                                        {isMine && user.AvatarUrl ? (
                                                            <img src={`http://localhost:5000${user.AvatarUrl}`} alt="Avatar" style={{width: '100%', height: '100%', objectFit: 'cover'}}/>
                                                        ) : (!isMine && (msg.AvatarUrl || selectedFriend.AvatarUrl)) ? (
                                                            <img src={`http://localhost:5000${msg.AvatarUrl || selectedFriend.AvatarUrl}`} alt="Avatar" style={{width: '100%', height: '100%', objectFit: 'cover'}}/>
                                                        ) : (
                                                            <UserIcon size={12} />
                                                        )}
                                                    </div>
                                                    <span>{isMine ? 'You' : (selectedFriend.FullName || selectedFriend.Username)}</span>
                                                    <span style={{fontSize: '11px'}}>{new Date(msg.CreatedAt || Date.now()).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                                                </div>
                                                <div className="message-bubble">
                                                    {msg.ImageUrl ? (
                                                        <div>
                                                            {msg.Content !== 'Sent an image' && <div style={{marginBottom: '8px'}}>{msg.Content}</div>}
                                                            <img src={`http://localhost:5000${msg.ImageUrl}`} alt="attachment" className="chat-image" />
                                                        </div>
                                                    ) : msg.AttachmentUrl ? (
                                                        <div>
                                                            {msg.Content && <div style={{marginBottom: '8px'}}>{msg.Content}</div>}
                                                            <div style={{display: 'flex', alignItems: 'center', background: 'rgba(0,0,0,0.1)', padding: '8px', borderRadius: '8px'}}>
                                                                <Folder size={20} style={{marginRight: '8px', color: 'var(--primary-color)'}} />
                                                                <a href={`http://localhost:5000${msg.AttachmentUrl}`} target="_blank" rel="noopener noreferrer" style={{color: 'var(--primary-color)', textDecoration: 'none'}}>Download File</a>
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        msg.Content
                                                    )}
                                                </div>
                                                {isMine && (
                                                    <div className="message-status">
                                                        <CheckCheck size={14} /> Read
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })
                                )}
                                <div ref={messagesEndRef} />
                            </div>

                            <div className="input-area-container">
                                <form className="input-box" onSubmit={handleSendMessage}>
                                    <div className="input-toolbar">
                                        <Bold size={18} />
                                        <Code size={18} />
                                        <List size={18} />
                                    </div>
                                    <div className="input-main" style={{position: 'relative'}}>
                                        {showEmojiPicker && (
                                            <div style={{position: 'absolute', bottom: '100%', left: '0', zIndex: 100, marginBottom: '10px'}}>
                                                <EmojiPicker onEmojiClick={(emojiData) => setNewMessage(prev => prev + emojiData.emoji)} theme={isDarkMode ? 'dark' : 'light'} />
                                            </div>
                                        )}
                                        <Smile size={20} style={{color: 'var(--text-secondary)', marginRight: '12px', cursor: 'pointer'}} onClick={() => setShowEmojiPicker(!showEmojiPicker)} />
                                        <input
                                            type="text"
                                            placeholder="Type a message..."
                                            value={newMessage}
                                            onChange={handleMessageChange}
                                        />
                                        <div className="input-actions">
                                            <label style={{cursor: 'pointer', display: 'flex', alignItems: 'center'}} title="Attach Image">
                                                <Paperclip size={20} />
                                                <input type="file" style={{display: 'none'}} accept="image/*" onChange={handleImageUpload} />
                                            </label>
                                            <label style={{cursor: 'pointer', display: 'flex', alignItems: 'center'}} title="Attach Document">
                                                <Folder size={20} />
                                                <input type="file" style={{display: 'none'}} accept=".pdf,.doc,.docx,.xls,.xlsx,.zip,.txt" onChange={handleDocumentUpload} />
                                            </label>
                                            <button type="submit" className="btn-send" disabled={!newMessage.trim()}>
                                                <span style={{fontWeight: 'bold', fontSize: '14px'}}>Send</span>
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
                                    <h2>Welcome Home</h2>
                                    <p>Your dashboard is empty right now.</p>
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

                {/* COLUMN 4: WIDGETS PANE */}
                <aside className="widgets-pane">
                    <div className="widget-section">
                        <div className="widget-header">
                            <span>Calendar</span>
                            <Settings size={16} />
                        </div>
                        <div className="calendar-widget">
                            <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: '16px', color: 'var(--text-primary)', fontWeight: 'bold'}}>
                                <span>&lt;</span>
                                <span>{["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][new Date().getMonth()]} {new Date().getFullYear()}</span>
                                <span>&gt;</span>
                            </div>
                            <div className="calendar-grid">
                                <div className="calendar-day-header">Su</div>
                                <div className="calendar-day-header">Mo</div>
                                <div className="calendar-day-header">Tu</div>
                                <div className="calendar-day-header">We</div>
                                <div className="calendar-day-header">Th</div>
                                <div className="calendar-day-header">Fr</div>
                                <div className="calendar-day-header">Sa</div>
                                {[...Array(new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate())].map((_, i) => (
                                    <div key={i} className={`calendar-day ${i + 1 === new Date().getDate() ? 'active' : ''}`}>{i + 1}</div>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className="tasks-widget">
                        <div className="widget-header">
                            <span>Team Tasks</span>
                            <Menu size={16} />
                        </div>
                        <div style={{padding: '0 16px', marginBottom: '8px'}}>
                            <input 
                                type="text" 
                                placeholder="Add new task... (Press Enter)" 
                                value={newTaskTitle}
                                onChange={(e) => setNewTaskTitle(e.target.value)}
                                onKeyDown={handleAddTask}
                                style={{width: '100%', padding: '8px', borderRadius: '8px', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', color: 'white'}}
                            />
                        </div>
                        <div style={{maxHeight: '200px', overflowY: 'auto'}}>
                            {tasks.map(task => (
                                <div key={task.Id} className={`task-item ${task.IsCompleted ? 'completed' : ''}`} onClick={() => handleToggleTask(task)}>
                                    <div className="task-checkbox" style={task.IsCompleted ? {background: 'var(--primary-color)', borderColor: 'var(--primary-color)'} : {}}></div>
                                    <div className="task-content">
                                        <h4>{task.Title}</h4>
                                        <p>{new Date(task.CreatedAt).toLocaleDateString()}</p>
                                    </div>
                                </div>
                            ))}
                            {tasks.length === 0 && <div style={{padding: '16px', color: 'var(--text-secondary)', fontSize: '12px'}}>No tasks yet.</div>}
                        </div>
                    </div>
                </aside>

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
        </div>
    );
};

export default Chat;
