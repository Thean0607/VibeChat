import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { socket } from '../socket';
import { LogIn } from 'lucide-react';
import './Login.css';

const Login = ({ setUser }) => {
    const [username, setUsername] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    const handleLogin = async (e) => {
        e.preventDefault();
        if (!username.trim()) return;
        
        setLoading(true);
        try {
            const response = await axios.post('http://localhost:5000/api/login', { username });
            const loggedInUser = response.data.user;
            setUser(loggedInUser);
            
            socket.auth = { username: loggedInUser.Username };
            socket.connect();
            socket.emit('join', loggedInUser);
            
            navigate('/chat');
        } catch (err) {
            setError('Failed to login. Please ensure the backend is running.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="login-container">
            <div className="glass-panel login-panel">
                <div className="login-header">
                    <h2>Welcome to VibeChat</h2>
                    <p>Join the conversation</p>
                </div>
                
                {error && <div className="error-message">{error}</div>}
                
                <form onSubmit={handleLogin}>
                    <div className="input-group">
                        <input
                            type="text"
                            className="input-field"
                            placeholder="Enter your username"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            disabled={loading}
                            autoFocus
                        />
                    </div>
                    
                    <button type="submit" className="btn-primary login-btn" disabled={loading || !username.trim()}>
                        {loading ? 'Joining...' : (
                            <>
                                Join Chat <LogIn size={18} />
                            </>
                        )}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default Login;
