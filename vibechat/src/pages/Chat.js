import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { socket } from '../socket';
import { Send, LogOut, User as UserIcon } from 'lucide-react';
import './Chat.css';

const Chat = ({ user, setUser }) => {
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState('');
    const messagesEndRef = useRef(null);
    const navigate = useNavigate();

    useEffect(() => {
        if (!user) {
            navigate('/');
            return;
        }

        const fetchMessages = async () => {
            try {
                const response = await axios.get('http://localhost:5000/api/messages');
                setMessages(response.data);
            } catch (err) {
                console.error("Failed to fetch messages", err);
            }
        };

        fetchMessages();

        socket.on('receiveMessage', (message) => {
            setMessages((prevMessages) => [...prevMessages, message]);
        });

        return () => {
            socket.off('receiveMessage');
        };
    }, [user, navigate]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    const handleSendMessage = (e) => {
        e.preventDefault();
        if (!newMessage.trim()) return;

        socket.emit('sendMessage', {
            senderId: user.Id,
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

    return (
        <div className="chat-container">
            <div className="glass-panel chat-panel">
                <header className="chat-header">
                    <div className="user-info">
                        <div className="avatar">
                            <UserIcon size={20} />
                        </div>
                        <span className="username">{user.Username}</span>
                    </div>
                    <button onClick={handleLogout} className="btn-logout">
                        <LogOut size={18} />
                    </button>
                </header>

                <div className="chat-messages">
                    {messages.map((msg, index) => {
                        const isMine = msg.SenderId === user.Id;
                        return (
                            <div key={msg.Id || index} className={`message-wrapper ${isMine ? 'mine' : 'other'}`}>
                                {!isMine && <div className="message-sender">{msg.Username}</div>}
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
                        placeholder="Type a message..."
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                    />
                    <button type="submit" className="btn-primary send-btn" disabled={!newMessage.trim()}>
                        <Send size={18} />
                    </button>
                </form>
            </div>
        </div>
    );
};

export default Chat;
