import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { socket } from '../socket';
import { 
    LogOut, User as UserIcon, MessageSquare, Users, 
    Settings, Search, 
    Home, Video, Menu, CheckCheck, Phone, Paperclip, Folder, Smile, Bold, Code, List
} from 'lucide-react';
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
    const messagesEndRef = useRef(null);
    const navigate = useNavigate();

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
            const response = await axios.get(`http://localhost:5000/api/friends/${user.Id}`);
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
        fetchFriends();
    }, [user, navigate, fetchFriends]);

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

    // Socket
    useEffect(() => {
        const handleReceiveMessage = (message) => {
            if (
                selectedFriend && 
                ((message.SenderId === user.Id && message.ReceiverId === selectedFriend.Id) || 
                 (message.SenderId === selectedFriend.Id && message.ReceiverId === user.Id))
            ) {
                setMessages(prev => [...prev, message]);
            }
        };
        socket.on('receiveMessage', handleReceiveMessage);
        return () => socket.off('receiveMessage', handleReceiveMessage);
    }, [selectedFriend, user]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    const handleSendMessage = (e) => {
        e.preventDefault();
        if (!newMessage.trim() || !selectedFriend) return;
        socket.emit('sendMessage', {
            senderId: user.Id,
            receiverId: selectedFriend.Id,
            content: newMessage,
            username: user.Username
        });
        setNewMessage('');
    };

    const handleLogout = () => {
        socket.disconnect();
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
                                    onClick={() => setSelectedFriend(friend)}
                                >
                                    <div style={{position: 'relative'}}>
                                        <div className="chat-avatar" style={{background: 'var(--primary-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white'}}>
                                            <UserIcon size={24} />
                                        </div>
                                        <div className="chat-status-dot"></div>
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
                                        <div className="chat-avatar" style={{background: 'var(--primary-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white'}}>
                                            <UserIcon size={24} />
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
                                    <div className="chat-avatar" style={{background: 'var(--primary-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white'}}>
                                        <UserIcon size={24} />
                                    </div>
                                    <div className="header-user-text">
                                        <h3>{selectedFriend.FullName || selectedFriend.Username}</h3>
                                        <div className="header-user-status">
                                            <div className="chat-status-dot"></div> Online - Typing...
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
                                        const isMine = msg.SenderId === user.Id;
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
                                                    {msg.Content}
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
                                    <div className="input-main">
                                        <Smile size={20} style={{color: 'var(--text-secondary)', marginRight: '12px'}} />
                                        <input
                                            type="text"
                                            placeholder="Type a message..."
                                            value={newMessage}
                                            onChange={(e) => setNewMessage(e.target.value)}
                                        />
                                        <div className="input-actions">
                                            <Paperclip size={20} />
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
