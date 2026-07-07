import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { socket } from '../socket';
import { LogIn, UserPlus, MessageCircle, Mail } from 'lucide-react';
import './Login.css';

const FacebookIcon = ({ size = 24, color = "currentColor" }) => (
    <svg 
        xmlns="http://www.w3.org/2000/svg" 
        width={size} 
        height={size} 
        viewBox="0 0 24 24" 
        fill={color} 
        stroke="none"
    >
        <path d="M9 8h-3v4h3v12h5v-12h3.642l.358-4h-4v-1.667c0-.955.192-1.333 1.115-1.333h2.885v-5h-3.808c-3.596 0-5.192 1.583-5.192 4.615v3.385z"/>
    </svg>
);


const Login = ({ setUser }) => {
    const [isLogin, setIsLogin] = useState(true);
    const [username, setUsername] = useState('demo');
    const [password, setPassword] = useState('123');
    const [isSocialReg, setIsSocialReg] = useState(false);
    const [linkingProvider, setLinkingProvider] = useState(null);
    
    // Additional fields for Register
    const [fullName, setFullName] = useState('');
    const [dateOfBirth, setDateOfBirth] = useState('');
    const [email, setEmail] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [acceptTerms, setAcceptTerms] = useState(false);
    
    const handleSocialClick = (provider) => {
        if (isLogin) {
            alert(`Tính năng đăng nhập bằng ${provider} đang được phát triển.`);
        } else {
            setLinkingProvider(provider);
            setTimeout(() => {
                setLinkingProvider(null);
                setIsSocialReg(true);
            }, 1500);
        }
    };
    
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        
        // Validation for both
        if (!username.trim() || !password.trim()) {
            setError('Please fill in required fields (Username and Password)');
            return;
        }

        // Additional validation for Register
        if (!isLogin) {
            if (password !== confirmPassword) {
                setError('Passwords do not match');
                return;
            }
            if (!acceptTerms) {
                setError('You must accept the Terms and Conditions');
                return;
            }
        }
        
        setLoading(true);
        
        try {
            const endpoint = isLogin ? '/api/login' : '/api/register';
            const payload = isLogin 
                ? { username, password }
                : { username, password, fullName, dateOfBirth, email };
                
            const response = await axios.post(`http://${window.location.hostname}:5000${endpoint}`, payload);
            
            const loggedInUser = response.data.user;
            setUser(loggedInUser);
            
            socket.auth = { username: loggedInUser.Username };
            socket.connect();
            socket.emit('join', loggedInUser);
            
            navigate('/chat');
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to connect to server');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="landing-container">
            <div className="landing-content">
                {/* Left Side: Intro */}
                <div className="landing-intro">
                    <div className="logo-area">
                        <MessageCircle size={48} className="logo-icon" />
                        <h1 className="logo-text">VibeChat</h1>
                    </div>
                    <h2>Connect with your vibe.</h2>
                    <p>Experience real-time conversations in a beautifully crafted, modern interface. Join the community today and start sharing your thoughts securely.</p>
                </div>

                {/* Right Side: Auth Form */}
                <div className="landing-form-container">
                    <div className="glass-panel auth-panel">
                        <div className="auth-header">
                            <h2>{isLogin ? 'Welcome Back' : 'Create Account'}</h2>
                            <p>{isLogin ? 'Login to continue your chats' : 'Sign up to get started'}</p>
                        </div>
                        
                        {error && <div className="error-message">{error}</div>}
                        
                        <form onSubmit={handleSubmit} className="auth-form">
                            {!isLogin && !isSocialReg && (
                                <div className="form-scroll-area">
                                    <div className="input-row">
                                        <div className="input-group">
                                            <label>Full Name</label>
                                            <input
                                                type="text"
                                                className="input-field"
                                                placeholder="John Doe"
                                                value={fullName}
                                                onChange={(e) => setFullName(e.target.value)}
                                                disabled={loading}
                                            />
                                        </div>
                                        <div className="input-group">
                                            <label>Date of Birth</label>
                                            <input
                                                type="date"
                                                className="input-field"
                                                value={dateOfBirth}
                                                onChange={(e) => setDateOfBirth(e.target.value)}
                                                disabled={loading}
                                            />
                                        </div>
                                    </div>
                                    <div className="input-group">
                                        <label>Email Address</label>
                                        <input
                                            type="email"
                                            className="input-field"
                                            placeholder="john@example.com"
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                            disabled={loading}
                                        />
                                    </div>
                                </div>
                            )}

                            {!isLogin && isSocialReg && (
                                <div className="social-reg-notice">
                                    <p style={{color: 'var(--primary-color)', marginBottom: '16px', fontSize: '14px'}}>
                                        Account linked! Please choose a username and password to complete registration.
                                    </p>
                                </div>
                            )}

                            <div className="input-group">
                                <label>{isLogin ? 'Username or Email' : 'Username'} <span className="text-red">*</span></label>
                                <input
                                    type="text"
                                    className="input-field"
                                    placeholder={isLogin ? 'Enter your username or email' : 'Enter your username'}
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                    disabled={loading}
                                    autoFocus
                                />
                            </div>
                            
                            <div className="input-group">
                                <label>Password <span className="text-red">*</span></label>
                                <input
                                    type="password"
                                    className="input-field"
                                    placeholder="Enter your password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    disabled={loading}
                                />
                            </div>

                            {!isLogin && (
                                <>
                                    <div className="input-group">
                                        <label>Confirm Password <span className="text-red">*</span></label>
                                        <input
                                            type="password"
                                            className="input-field"
                                            placeholder="Confirm your password"
                                            value={confirmPassword}
                                            onChange={(e) => setConfirmPassword(e.target.value)}
                                            disabled={loading}
                                        />
                                    </div>
                                    <div className="checkbox-group">
                                        <label className="checkbox-label">
                                            <input 
                                                type="checkbox" 
                                                checked={acceptTerms}
                                                onChange={(e) => setAcceptTerms(e.target.checked)}
                                                disabled={loading}
                                            />
                                            <span className="checkmark"></span>
                                            I accept the <a href="/terms" className="terms-link">Terms and Conditions</a>
                                        </label>
                                    </div>
                                </>
                            )}
                            
                            <button type="submit" className="btn-primary login-btn" disabled={loading}>
                                {loading ? 'Processing...' : (
                                    <>
                                        {isLogin ? 'Login' : 'Sign Up'} {isLogin ? <LogIn size={18} /> : <UserPlus size={18} />}
                                    </>
                                )}
                            </button>
                            
                            {!isSocialReg && (
                                <div className="social-login-container">
                                    <div className="divider">
                                        <span>OR</span>
                                    </div>
                                    <div className="social-buttons">
                                        <button 
                                            type="button" 
                                            className="btn-social btn-facebook"
                                            onClick={() => handleSocialClick('Facebook')}
                                            disabled={linkingProvider !== null}
                                            title="Continue with Facebook"
                                        >
                                            <FacebookIcon size={24} />
                                        </button>
                                        <button 
                                            type="button" 
                                            className="btn-social btn-google"
                                            onClick={() => handleSocialClick('Google')}
                                            disabled={linkingProvider !== null}
                                            title="Continue with Google"
                                        >
                                            <Mail size={24} />
                                        </button>
                                    </div>
                                </div>
                            )}
                        </form>
                        
                        <div className="auth-toggle">
                            <p>
                                {isLogin ? "Don't have an account? " : "Already have an account? "}
                                <span className="toggle-link" onClick={() => {
                                    setIsLogin(!isLogin);
                                    setIsSocialReg(false);
                                }}>
                                    {isLogin ? 'Sign up here' : 'Login here'}
                                </span>
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Login;
