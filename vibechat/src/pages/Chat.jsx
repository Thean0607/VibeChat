import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { socket } from '../socket';
import { LogOut, User as UserIcon, MessageSquare, Users, 
    Settings, Search, 
    Home, Video, Menu, CheckCheck, Phone, Paperclip, Folder, Smile, Bold, Code, List
} from 'lucide-react';
import EmojiPicker from 'emoji-picker-react';
import { generateSharedKey, encryptMessage, decryptMessage } from '../utils/encryption';
import './Chat.css';

const Chat = ({ user, setUser }) => {
    const [activeTab, setActiveTab] = useState('chats'); // 'chats', 'people', 'profile', 'settings'
    const [friendsList, setFriendsList] = useState([]);
    const [searchResults, setSearchResults] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [isDarkMode, setIsDarkMode] = useState(false);
    
    const [selectedProfile, setSelectedProfile] = useState(null);
    const [selectedFriend, setSelectedFriend] = useState(null);
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState('');
    const [onlineUsers, setOnlineUsers] = useState([]);
    const [typingUsers, setTypingUsers] = useState(new Set());
    const [isUploading, setIsUploading] = useState(false);
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    const messagesEndRef = useRef(null);
    const navigate = useNavigate();

    const handleTabChange = (tab) => {
        setActiveTab(tab);
        setSelectedProfile(null);
    };

    useEffect(() => {
        if (isDarkMode) {
            document.body.classList.add('dark-theme');
        } else {
            document.body.classList.remove('dark-theme');
        }
    }, [isDarkMode]);

    // Fetch friendships
    const fetchFriends = useCallback(async () => {
        if (!user) return;
        try {
            const response = await axios.get(`http://${window.location.hostname}:5000/api/friends/${user.Id}`);
            setFriendsList(response.data);
        } catch (err) {
            console.error("Failed to fetch friends", err);
        }
    }, [user]);

    useEffect(() => {
        if (!user) {
            navigate('/');
            return;
        }
        if (!socket.connected) {
            socket.connect();
        }
        fetchFriends();
    }, [user, navigate, fetchFriends]);

    // Handle search users
    useEffect(() => {
        if (activeTab === 'people') {
            const delayDebounceFn = setTimeout(async () => {
                if (searchQuery.trim().length > 0) {
                    try {
                        const response = await axios.get(`http://${window.location.hostname}:5000/api/users/search?q=${searchQuery}&currentUserId=${user.Id}`);
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
            const res = await axios.post(`http://${window.location.hostname}:5000/api/friends/request`, {
                requesterId: user.Id,
                addresseeId
            });
            if (res.data.autoAccepted) {
                setSelectedProfile(prev => ({...prev, Status: 'accepted'}));
            } else {
                setSelectedProfile(prev => ({...prev, Status: 'pending', RequesterId: user.Id, AddresseeId: addresseeId}));
            }
            setSearchQuery(prev => prev + ' '); 
            setSearchQuery(prev => prev.trim());
            fetchFriends();
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
        } catch (err) {
            console.error(err);
        }
    };

    // Messages
    useEffect(() => {
        if (!selectedFriend || !user) return;
        const fetchMessages = async () => {
            try {
                const response = await axios.get(`http://${window.location.hostname}:5000/api/messages?user1=${user.Id}&user2=${selectedFriend.Id}`);
                
                const sharedKey = generateSharedKey(user.Id, selectedFriend.Id);
                const decryptedMessages = response.data.map(msg => ({
                    ...msg,
                    Content: decryptMessage(msg.Content, sharedKey)
                }));
                
                setMessages(decryptedMessages);
            } catch (err) {
                console.error("Failed to fetch messages", err);
            }
        };
        fetchMessages();
    }, [selectedFriend, user]);

    // Socket
    useEffect(() => {
        const handleReceiveMessage = (message) => {
            console.log("Received message via socket:", message);
            if (
                selectedFriend && 
                ((message.SenderId == user.Id && message.ReceiverId == selectedFriend.Id) || 
                 (message.SenderId == selectedFriend.Id && message.ReceiverId == user.Id))
            ) {
                const sharedKey = generateSharedKey(user.Id, selectedFriend.Id);
                const decryptedMsg = {
                    ...message,
                    Content: message.Content ? decryptMessage(message.Content, sharedKey) : ''
                };
                setMessages(prev => [...prev, decryptedMsg]);
                
                if (message.SenderId == selectedFriend.Id) {
                    axios.post(`http://${window.location.hostname}:5000/api/messages/read`, {
                        senderId: selectedFriend.Id,
                        receiverId: user.Id
                    }).catch(console.error);
                }
            }
            
            setFriendsList(prev => {
                const otherUserId = message.SenderId == user.Id ? message.ReceiverId : message.SenderId;
                return prev.map(f => {
                    if (f.Id == otherUserId) {
                        const isCurrentlyOpen = selectedFriend && selectedFriend.Id == otherUserId;
                        const isIncoming = message.SenderId == otherUserId;
                        return {
                            ...f,
                            LastMessageAt: message.CreatedAt,
                            UnreadCount: (isIncoming && !isCurrentlyOpen) ? (f.UnreadCount || 0) + 1 : (f.UnreadCount || 0)
                        };
                    }
                    return f;
                });
            });
        };
        
        const handleOnlineUsers = (users) => {
            setOnlineUsers(users);
        };
        
        const handleTypingEvent = ({ senderId, receiverId, isTyping }) => {
            if (receiverId == user.Id) {
                setTypingUsers(prev => {
                    const newSet = new Set(prev);
                    if (isTyping) newSet.add(senderId);
                    else newSet.delete(senderId);
                    return newSet;
                });
            }
        };
        
        const handleMessagesRead = ({ senderId, receiverId }) => {
            if (senderId == user.Id && selectedFriend && receiverId == selectedFriend.Id) {
                setMessages(prev => prev.map(msg => 
                    (msg.SenderId == user.Id && msg.ReceiverId == receiverId) ? { ...msg, IsRead: true } : msg
                ));
            }
        };
        
        socket.on('receiveMessage', handleReceiveMessage);
        socket.on('onlineUsers', handleOnlineUsers);
        socket.on('typing', handleTypingEvent);
        socket.on('messagesRead', handleMessagesRead);
        return () => {
            socket.off('receiveMessage', handleReceiveMessage);
            socket.off('onlineUsers', handleOnlineUsers);
            socket.off('typing', handleTypingEvent);
            socket.off('messagesRead', handleMessagesRead);
        };
    }, [selectedFriend, user]);

    useEffect(() => {
        socket.on('friendUpdate', fetchFriends);
        return () => socket.off('friendUpdate', fetchFriends);
    }, [fetchFriends]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    const handleSendMessage = (e) => {
        e.preventDefault();
        if (!newMessage.trim() || !selectedFriend) return;
        
        const sharedKey = generateSharedKey(user.Id, selectedFriend.Id);
        const encryptedContent = encryptMessage(newMessage, sharedKey);
        
        socket.emit('sendMessage', {
            senderId: user.Id,
            receiverId: selectedFriend.Id,
            content: encryptedContent,
            username: user.Username,
            attachmentUrl: null
        });
        setNewMessage('');
    };

    const handleFileUpload = async (e) => {
        const file = e.target.files[0];
        if (!file || !selectedFriend) return;
        
        setIsUploading(true);
        const formData = new FormData();
        formData.append('file', file);
        
        try {
            const res = await axios.post(`http://${window.location.hostname}:5000/api/upload`, formData);
            const attachmentUrl = res.data.url;
            
            socket.emit('sendMessage', {
                senderId: user.Id,
                receiverId: selectedFriend.Id,
                content: '',
                username: user.Username,
                attachmentUrl
            });
        } catch (err) {
            console.error("Upload failed", err);
        } finally {
            setIsUploading(false);
            e.target.value = null; // reset
        }
    };

    const handleLogout = () => {
        socket.disconnect();
        setUser(null);
        navigate('/');
    };

    if (!user) return null;

    const activeFriends = friendsList
        .filter(f => f.Status === 'accepted')
        .sort((a, b) => {
            const timeA = a.LastMessageAt ? new Date(a.LastMessageAt).getTime() : 0;
            const timeB = b.LastMessageAt ? new Date(b.LastMessageAt).getTime() : 0;
            return timeB - timeA;
        });
    const pendingRequests = friendsList.filter(f => f.Status === 'pending' && f.AddresseeId == user.Id);

    const handleSelectFriend = async (friend) => {
        setSelectedFriend(friend);
        if (friend.UnreadCount > 0) {
            try {
                await axios.post(`http://${window.location.hostname}:5000/api/messages/read`, {
                    senderId: friend.Id,
                    receiverId: user.Id
                });
                setFriendsList(prev => prev.map(f => f.Id === friend.Id ? { ...f, UnreadCount: 0 } : f));
            } catch (err) {
                console.error("Failed to mark messages as read", err);
            }
        }
    };

    const renderListPane = () => {
        if (activeTab === 'chats') {
            return (
                <>
                    <div className="chat-list-header">
                        <h2>Chat List</h2>
                        <div className="search-bar">
                            <Search size={18} className="search-icon" color="var(--text-secondary)" />
                            <input key="chats-search" type="text" placeholder="Search" />
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
                                        <div className="chat-avatar" style={{background: 'var(--primary-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white'}}>
                                            <UserIcon size={24} />
                                        </div>
                                        <div className="chat-status-dot" style={{ background: onlineUsers.includes(friend.Id) ? '#22c55e' : '#6b7280' }}></div>
                                        {friend.UnreadCount > 0 && (
                                            <div style={{
                                                position: 'absolute',
                                                right: '-4px',
                                                top: '-4px',
                                                background: '#ef4444',
                                                color: 'white',
                                                borderRadius: '10px',
                                                padding: '2px 6px',
                                                fontSize: '10px',
                                                fontWeight: 'bold',
                                                border: '2px solid var(--surface-light)'
                                            }}>
                                                {friend.UnreadCount}
                                            </div>
                                        )}
                                    </div>
                                    <div className="chat-item-info">
                                        <div className="chat-item-top">
                                            <span className="chat-item-name" style={{fontWeight: friend.UnreadCount > 0 ? 'bold' : 'normal'}}>{friend.FullName || friend.Username}</span>
                                            <span className="chat-item-time" style={{color: friend.UnreadCount > 0 ? 'var(--primary-color)' : 'var(--text-secondary)'}}>
                                                {friend.LastMessageAt ? new Date(friend.LastMessageAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : ''}
                                            </span>
                                        </div>
                                        <div className="chat-item-snippet" style={{fontWeight: friend.UnreadCount > 0 ? 'bold' : 'normal', color: friend.UnreadCount > 0 ? 'var(--text-primary)' : 'var(--text-secondary)'}}>
                                            {friend.UnreadCount > 0 ? `${friend.UnreadCount} unread message(s)` : 'Click to view messages'}
                                        </div>
                                    </div>
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
                                key="people-search"
                                type="text" 
                                placeholder="Search users..." 
                                value={searchQuery || ''}
                                onChange={e => setSearchQuery(e.target.value)}
                            />
                        </div>
                    </div>
                    <div className="chat-items">
                        {pendingRequests.length > 0 && (
                            <div style={{marginBottom: '16px'}}>
                                <h3 style={{fontSize: '12px', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '8px'}}>Requests</h3>
                                {pendingRequests.map(req => (
                                    <div key={req.Id} className="chat-item" style={{cursor: 'pointer'}} onClick={() => setSelectedProfile(req)}>
                                        <div className="chat-avatar" style={{background: 'var(--primary-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white'}}>
                                            <UserIcon size={24} />
                                        </div>
                                        <div className="chat-item-info">
                                            <span className="chat-item-name">{req.FullName || req.Username}</span>
                                        </div>
                                        <button onClick={(e) => { e.stopPropagation(); acceptFriendRequest(req.RequesterId || req.Id); }} style={{background: 'var(--primary-color)', color: 'white', border: 'none', borderRadius: '8px', padding: '6px 12px', cursor: 'pointer', zIndex: 10}}>
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
                                    <div key={su.Id} className="chat-item" style={{cursor: 'pointer'}} onClick={() => setSelectedProfile(su)}>
                                        <div className="chat-avatar" style={{background: 'var(--primary-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white'}}>
                                            <UserIcon size={24} />
                                        </div>
                                        <div className="chat-item-info">
                                            <span className="chat-item-name">{su.FullName || su.Username}</span>
                                        </div>
                                        {su.Status === 'accepted' ? (
                                            <span style={{fontSize: '12px', color: 'var(--primary-color)'}}>Friend</span>
                                        ) : su.Status === 'pending' ? (
                                            <span style={{fontSize: '12px', color: 'var(--text-secondary)'}}>Pending</span>
                                        ) : (
                                            <button onClick={(e) => { e.stopPropagation(); sendFriendRequest(su.Id); setSelectedProfile({...su, Status: 'pending'}); }} style={{background: 'rgba(255,255,255,0.1)', border: '1px solid var(--glass-border)', borderRadius: '8px', padding: '6px 12px', cursor: 'pointer', color: 'var(--text-primary)'}}>
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
                                    checked={!!isDarkMode} 
                                    onChange={(e) => setIsDarkMode(e.target.checked)} 
                                    style={{ width: '18px', height: '18px', marginRight: '8px', cursor: 'pointer' }} 
                                />
                                <span style={{fontSize: '14px', color: 'var(--text-secondary)'}}>{isDarkMode ? 'On' : 'Off'}</span>
                            </label>
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
                    <div className="nav-avatar" style={{background: 'var(--primary-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white'}}>
                        <UserIcon size={24} />
                        <div className="nav-status-dot"></div>
                    </div>
                    <div className="nav-items">
                        <button className={`nav-item ${activeTab === 'home' ? 'active' : ''}`} onClick={() => handleTabChange('home')} title="Home">
                            <Home size={24} />
                        </button>
                        <button className={`nav-item ${activeTab === 'chats' ? 'active' : ''}`} onClick={() => handleTabChange('chats')} title="Chats">
                            <MessageSquare size={24} />
                        </button>
                        <button className={`nav-item ${activeTab === 'people' ? 'active' : ''}`} onClick={() => handleTabChange('people')} title="People" style={{position: 'relative'}}>
                            <Users size={24} />
                            {pendingRequests.length > 0 && (
                                <span style={{position: 'absolute', top: 4, right: 4, background: '#ef4444', color: 'white', borderRadius: '50%', fontSize: '10px', width: '16px', height: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold'}}>
                                    {pendingRequests.length}
                                </span>
                            )}
                        </button>
                    </div>
                    <div className="nav-bottom">
                        <button className={`nav-item ${activeTab === 'settings' ? 'active' : ''}`} onClick={() => handleTabChange('settings')} title="Settings">
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
                    {selectedProfile ? (
                        <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-primary)'}}>
                            <div style={{width: 120, height: 120, borderRadius: '50%', background: 'var(--primary-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 48, marginBottom: 24}}>
                                {selectedProfile.FullName ? selectedProfile.FullName[0].toUpperCase() : selectedProfile.Username[0].toUpperCase()}
                            </div>
                            <h2>{selectedProfile.FullName || selectedProfile.Username}</h2>
                            <p style={{color: 'var(--text-secondary)', marginBottom: 8}}>@{selectedProfile.Username}</p>
                            
                            <div style={{background: 'rgba(255,255,255,0.05)', padding: 24, borderRadius: 16, width: '100%', maxWidth: 400, marginTop: 24}}>
                                <div style={{marginBottom: 16}}>
                                    <label style={{color: 'var(--text-secondary)', fontSize: 12, textTransform: 'uppercase'}}>Bio</label>
                                    <p>{selectedProfile.Bio || 'No bio yet.'}</p>
                                </div>
                                {selectedProfile.Email && (
                                    <div style={{marginBottom: 16}}>
                                        <label style={{color: 'var(--text-secondary)', fontSize: 12, textTransform: 'uppercase'}}>Email</label>
                                        <p>{selectedProfile.Email}</p>
                                    </div>
                                )}
                                {selectedProfile.DateOfBirth && (
                                    <div style={{marginBottom: 16}}>
                                        <label style={{color: 'var(--text-secondary)', fontSize: 12, textTransform: 'uppercase'}}>Birthday</label>
                                        <p>{new Date(selectedProfile.DateOfBirth).toLocaleDateString()}</p>
                                    </div>
                                )}
                                
                                <div style={{marginTop: 32, display: 'flex', justifyContent: 'center'}}>
                                    {selectedProfile.Status === 'accepted' ? (
                                        <button className="btn-primary" style={{width: '100%', padding: '12px', border: 'none', borderRadius: '12px', cursor: 'pointer', background: 'var(--primary-color)', color: 'white', fontWeight: 'bold'}} onClick={() => { setSelectedFriend(selectedProfile); handleTabChange('chats'); }}>
                                            Message
                                        </button>
                                    ) : selectedProfile.Status === 'pending' ? (
                                        selectedProfile.AddresseeId == user.Id ? (
                                            <button className="btn-primary" style={{width: '100%', padding: '12px', border: 'none', borderRadius: '12px', cursor: 'pointer', background: 'var(--primary-color)', color: 'white', fontWeight: 'bold'}} onClick={() => {
                                                acceptFriendRequest(selectedProfile.RequesterId || selectedProfile.Id);
                                                setSelectedProfile({...selectedProfile, Status: 'accepted'});
                                            }}>
                                                Accept Request
                                            </button>
                                        ) : (
                                            <button className="btn-primary" disabled style={{width: '100%', padding: '12px', border: 'none', borderRadius: '12px', background: 'rgba(255,255,255,0.1)', color: 'var(--text-secondary)', fontWeight: 'bold'}}>
                                                Request Sent
                                            </button>
                                        )
                                    ) : (
                                        <button className="btn-primary" style={{width: '100%', padding: '12px', border: 'none', borderRadius: '12px', cursor: 'pointer', background: 'var(--primary-color)', color: 'white', fontWeight: 'bold'}} onClick={() => {
                                            sendFriendRequest(selectedProfile.Id);
                                        }}>
                                            Add Friend
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    ) : activeTab === 'chats' && selectedFriend ? (
                        <>
                            <header className="main-chat-header">
                                <div className="header-user-info">
                                    <div className="chat-avatar" style={{background: 'var(--primary-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white'}}>
                                        <UserIcon size={24} />
                                    </div>
                                    <div className="header-user-text">
                                        <h3>{selectedFriend.FullName || selectedFriend.Username}</h3>
                                        <div style={{fontSize: 12, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 4, marginTop: 4}}>
                                            <div className="chat-status-dot" style={{ background: onlineUsers.includes(selectedFriend.Id) ? '#22c55e' : '#6b7280' }}></div> 
                                            {onlineUsers.includes(selectedFriend.Id) ? 'Online' : 'Offline'}
                                            {typingUsers.has(selectedFriend.Id) && <span style={{marginLeft: 8, fontStyle: 'italic', color: 'var(--primary-color)'}}>typing...</span>}
                                        </div>
                                    </div>
                                </div>
                                <div className="header-actions">
                                    <Video size={20} />
                                    <Phone size={20} />
                                    <Settings size={20} />
                                </div>
                            </header>

                            <div className="messages-area">
                                {messages.length === 0 ? (
                                    <div style={{height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)'}}>
                                        <p>No messages yet. Say hi!</p>
                                    </div>
                                ) : (
                                    messages.map((msg, index) => {
                                        const isMine = msg.SenderId == user.Id;
                                        return (
                                            <div key={msg.Id || index} className={`message-wrapper ${isMine ? 'mine' : 'other'}`}>
                                                <div className="message-meta" style={{flexDirection: isMine ? 'row-reverse' : 'row'}}>
                                                    <div className="chat-avatar" style={{width: '24px', height: '24px', background: 'var(--primary-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', margin: 0}}>
                                                        <UserIcon size={12} />
                                                    </div>
                                                    <span>{isMine ? 'You' : (selectedFriend.FullName || selectedFriend.Username)}</span>
                                                    <span style={{fontSize: '11px'}}>{new Date(msg.CreatedAt || Date.now()).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                                                </div>
                                                <div className="message-bubble">
                                                    {msg.AttachmentUrl && (
                                                        <div style={{marginBottom: msg.Content ? '8px' : '0'}}>
                                                            <img src={msg.AttachmentUrl} alt="attachment" style={{maxWidth: '100%', borderRadius: '8px', maxHeight: '200px', objectFit: 'cover'}} />
                                                        </div>
                                                    )}
                                                    {msg.Content}
                                                </div>
                                                {isMine && (
                                                    <div className="message-status">
                                                        <CheckCheck size={14} color={msg.IsRead ? '#3b82f6' : 'var(--text-secondary)'} /> 
                                                        {msg.IsRead ? 'Read' : 'Delivered'}
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
                                        <Smile 
                                            size={20} 
                                            style={{color: showEmojiPicker ? 'var(--primary-color)' : 'var(--text-secondary)', marginRight: '12px', cursor: 'pointer'}} 
                                            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                                        />
                                        {showEmojiPicker && (
                                            <div style={{position: 'absolute', bottom: '60px', left: '0', zIndex: 1000}}>
                                                <EmojiPicker 
                                                    onEmojiClick={(emojiData) => {
                                                        setNewMessage(prev => prev + emojiData.emoji);
                                                    }}
                                                />
                                            </div>
                                        )}
                                        <input 
                                            type="text" 
                                            placeholder="Type a message..."  
                                            value={newMessage}
                                            onChange={(e) => {
                                                setNewMessage(e.target.value);
                                                if (socket.connected && selectedFriend) {
                                                    socket.emit('typing', { senderId: user.Id, receiverId: selectedFriend.Id, isTyping: true });
                                                    if (window.typingTimeout) clearTimeout(window.typingTimeout);
                                                    window.typingTimeout = setTimeout(() => {
                                                        socket.emit('typing', { senderId: user.Id, receiverId: selectedFriend.Id, isTyping: false });
                                                    }, 2000);
                                                }
                                            }}
                                        />
                                        <div className="input-actions">
                                            <label style={{cursor: 'pointer', display: 'flex'}}>
                                                <input type="file" style={{display: 'none'}} onChange={handleFileUpload} accept="image/*" />
                                                <Paperclip size={20} color={isUploading ? 'var(--primary-color)' : 'currentColor'} />
                                            </label>
                                            <Folder size={20} />
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
                                <span>Jul 2026</span>
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
                                {[...Array(31)].map((_, i) => (
                                    <div key={i} className={`calendar-day ${i + 1 === 1 ? 'active' : ''}`}>{i + 1}</div>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className="tasks-widget">
                        <div className="widget-header">
                            <span>Team Tasks</span>
                            <Menu size={16} />
                        </div>
                        <div className="task-item">
                            <div className="task-checkbox"></div>
                            <div className="task-content">
                                <h4>Update Component</h4>
                                <p>10 min ago</p>
                            </div>
                        </div>
                        <div className="task-item completed">
                            <div className="task-checkbox" style={{background: 'var(--primary-color)', borderColor: 'var(--primary-color)'}}></div>
                            <div className="task-content">
                                <h4>Team Sync</h4>
                                <p>1 hour ago</p>
                            </div>
                        </div>
                        <div className="task-item">
                            <div className="task-checkbox"></div>
                            <div className="task-content">
                                <h4>Review PRs</h4>
                                <p>2 hours ago</p>
                            </div>
                        </div>
                    </div>
                </aside>
            </div>
        </div>
    );
};

export default Chat;
