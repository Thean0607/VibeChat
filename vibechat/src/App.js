import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import axios from 'axios';
import Login from './pages/Login';
import Chat from './pages/Chat';
import { socket } from './socket';
import './App.css';

function App() {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkToken = async () => {
      const token = localStorage.getItem('token');
      if (token) {
        axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
        try {
          const response = await axios.get('http://localhost:5000/api/auth/me');
          setUser(response.data.user);
          socket.auth = { username: response.data.user.Username, token };
          socket.connect();
          socket.emit('join', response.data.user);
        } catch (error) {
          console.error("Token verification failed:", error);
          localStorage.removeItem('token');
          delete axios.defaults.headers.common['Authorization'];
        }
      }
      setIsLoading(false);
    };

    checkToken();
  }, []);

  if (isLoading) {
    return <div style={{height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0a0a0a', color: '#fff'}}>Loading...</div>;
  }

  return (
    <Router>
      <div className="App">
        <Routes>
          <Route path="/" element={user ? <Navigate to="/chat" /> : <Login setUser={setUser} />} />
          <Route path="/chat" element={user ? <Chat user={user} setUser={setUser} /> : <Navigate to="/" />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
