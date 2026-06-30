import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { socket } from '../socket';
import { Send, LogOut, User as UserIcon, MessageSquare, Users, Settings, UserCircle, Search, UserPlus, Check, Clock, Edit2, Mail } from 'lucide-react';
import './Chat.css';

const Chat = ({ user, setUser }) => {
    const [activeTab, setActiveTab] = useState('chats'); // 'chats', 'people', 'profile', 'settings'
    const [friendsList, setFriendsList] = useState([]);
    const [searchResults, setSearchResults] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    
    const [selectedFriend, setSelectedFriend] = useState(null);
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState('');
    const messagesEndRef = useRef(null);
    const navigate = useNavigate();

    // Fetch friendships
    const fetchFriends = async () => {
        if (!user) return;
        try {
            const response = await axios.get(`http://localhost:5000/api/friends/${user.Id}`);
            setFriendsList(response.data);
        } catch (err) {
            console.error("Failed to fetch friends", err);
        }
    };

    useEffect(() => {
        if (!user) {
            navigate('/');
            return;
        }
        fetchFriends();
    }, [user, navigate]);

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
            // refresh search results to update status
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

    // Derived state
    const activeFriends = friendsList.filter(f => f.Status === 'accepted');
    const pendingRequests = friendsList.filter(f => f.Status === 'pending' && f.AddresseeId === user.Id);

    // Renderer for Middle Pane
    const renderListPane = () => {
        if (activeTab === 'chats') {
            return (
                <>
                    <div className="pane-header">
                        <h2>Chats</h2>
                    </div>
                    <div className="pane-content">
                        {activeFriends.length === 0 ? (
                            <div className="empty-list">No friends yet. Go to People to add some!</div>
                        ) : (
                            activeFriends.map(friend => (
                                <div 
                                    key={friend.Id} 
                                    className={`list-item ${selectedFriend?.Id === friend.Id ? 'active' : ''}`}
                                    onClick={() => setSelectedFriend(friend)}
                                >
                                    <div className="avatar"><UserIcon size={20} /></div>
                                    <div className="item-info">
                                        <span className="item-name">{friend.FullName || friend.Username}</span>
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
                    <div className="pane-header">
                        <h2>People</h2>
                    </div>
                    <div className="pane-content">
                        <div className="search-box">
                            <Search size={16} className="search-icon" />
                            <input 
                                type="text" 
                                placeholder="Search users..." 
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                            />
                        </div>

                        {pendingRequests.length > 0 && (
                            <div className="section-block">
                                <h3>Friend Requests</h3>
                                {pendingRequests.map(req => (
                                    <div key={req.Id} className="list-item request-item">
                                        <div className="avatar"><UserIcon size={18} /></div>
                                        <div className="item-info">
                                            <span className="item-name">{req.FullName || req.Username}</span>
                                        </div>
                                        <button className="btn-icon accept" onClick={() => acceptFriendRequest(req.RequesterId)}>
                                            <Check size={16} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}

                        <div className="section-block">
                            {searchQuery ? <h3>Search Results</h3> : <h3>Suggested</h3>}
                            {searchResults.length === 0 && searchQuery ? (
                                <div className="empty-list">No users found</div>
                            ) : (
                                searchResults.map(su => (
                                    <div key={su.Id} className="list-item">
                                        <div className="avatar"><UserIcon size={18} /></div>
                                        <div className="item-info">
                                            <span className="item-name">{su.FullName || su.Username}</span>
                                        </div>
                                        {su.Status === 'accepted' ? (
                                            <span className="status-badge friend">Friend</span>
                                        ) : su.Status === 'pending' ? (
                                            <span className="status-badge pending">Pending</span>
                                        ) : (
                                            <button className="btn-icon add" onClick={() => sendFriendRequest(su.Id)}>
                                                <UserPlus size={16} />
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
                    <div className="pane-header">
                        <h2>Profile</h2>
                    </div>
                    <div className="pane-content profile-content">
                        <div className="profile-avatar-large">
                            <UserIcon size={64} />
                        </div>
                        <h2 className="profile-name">{user.FullName || user.Username}</h2>
                        <p className="profile-username">@{user.Username}</p>
                        
                        <div className="profile-details">
                            <div className="detail-row">
                                <label>Email</label>
                                <span>{user.Email || 'Not provided'}</span>
                            </div>
                            <div className="detail-row">
                                <label>Birthday</label>
                                <span>{user.DateOfBirth ? new Date(user.DateOfBirth).toLocaleDateString() : 'Not provided'}</span>
                            </div>
                        </div>
                        <button className="btn-secondary w-100 mt-20"><Edit2 size={16} style={{marginRight: '8px'}} /> Edit Profile</button>
                    </div>
                </>
            );
        }

        if (activeTab === 'settings') {
            return (
                <>
                    <div className="pane-header">
                        <h2>Settings</h2>
                    </div>
                    <div className="pane-content settings-content">
                        <div className="setting-item">
                            <div className="setting-info">
                                <h4>Dark Mode</h4>
                                <p>Toggle dark appearance</p>
                            </div>
                            <label className="switch">
                                <input type="checkbox" defaultChecked />
                                <span className="slider round"></span>
                            </label>
                        </div>
                        <div className="setting-item">
                            <div className="setting-info">
                                <h4>Notifications</h4>
                                <p>Enable sound and alerts</p>
                            </div>
                            <label className="switch">
                                <input type="checkbox" defaultChecked />
                                <span className="slider round"></span>
                            </label>
                        </div>
                    </div>
                </>
            );
        }
    };

    return (
        <div className="app-container">
            <div className="main-layout">
                {/* 1. NAV BAR */}
                <nav className="nav-bar">
                    <div className="nav-top">
                        <div className="nav-logo">VC</div>
                        <button className={`nav-item ${activeTab === 'chats' ? 'active' : ''}`} onClick={() => setActiveTab('chats')} title="Chats">
                            <MessageSquare size={24} />
                        </button>
                        <button className={`nav-item ${activeTab === 'people' ? 'active' : ''}`} onClick={() => setActiveTab('people')} title="People">
                            <div className="icon-wrapper">
                                <Users size={24} />
                                {pendingRequests.length > 0 && <span className="badge">{pendingRequests.length}</span>}
                            </div>
                        </button>
                    </div>
                    <div className="nav-bottom">
                        <button className={`nav-item ${activeTab === 'profile' ? 'active' : ''}`} onClick={() => setActiveTab('profile')} title="Profile">
                            <UserCircle size={24} />
                        </button>
                        <button className={`nav-item ${activeTab === 'settings' ? 'active' : ''}`} onClick={() => setActiveTab('settings')} title="Settings">
                            <Settings size={24} />
                        </button>
                        <button className="nav-item logout" onClick={handleLogout} title="Logout">
                            <LogOut size={24} />
                        </button>
                    </div>
                </nav>

                {/* 2. LIST PANE */}
                <aside className="list-pane">
                    {renderListPane()}
                </aside>

                {/* 3. CONTENT PANE */}
                <main className="content-pane">
                    {activeTab === 'chats' && selectedFriend ? (
                        <>
                            <header className="content-header">
                                <div className="user-info">
                                    <div className="avatar"><UserIcon size={24} /></div>
                                    <span className="username">{selectedFriend.FullName || selectedFriend.Username}</span>
                                </div>
                            </header>

                            <div className="chat-messages">
                                {messages.map((msg, index) => {
                                    const isMine = msg.SenderId === user.Id;
                                    return (
                                        <div key={msg.Id || index} className={`message-wrapper ${isMine ? 'mine' : 'other'}`}>
                                            <div className="message-bubble">
                                                {msg.Content}
                                            </div>
                                        </div>
                                    );
                                })}
                                <div ref={messagesEndRef} />
                            </div>

                            <form className="chat-input-area" onSubmit={handleSendMessage}>
                                <input
                                    type="text"
                                    className="input-field message-input"
                                    placeholder={`Message ${selectedFriend.FullName || selectedFriend.Username}...`}
                                    value={newMessage}
                                    onChange={(e) => setNewMessage(e.target.value)}
                                />
                                <button type="submit" className="btn-primary send-btn" disabled={!newMessage.trim()}>
                                    <Send size={18} />
                                </button>
                            </form>
                        </>
                    ) : (
                        <div className="empty-state">
                            <div className="empty-icon-wrapper">
                                <MessageSquare size={64} className="empty-icon" />
                            </div>
                            <h3>{activeTab === 'chats' ? 'Select a conversation' : 'VibeChat'}</h3>
                            <p>{activeTab === 'chats' ? 'Choose a friend from the list to start chatting.' : 'Connect and vibe with your friends seamlessly.'}</p>
                        </div>
                    )}
                </main>

            </div>
        </div>
    );
};

export default Chat;
