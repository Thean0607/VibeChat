const io = require('socket.io-client');
const socket = io('http://localhost:5000');

socket.on('connect', () => {
    console.log("Connected");
    socket.emit('sendMessage', {
        senderId: '5',
        receiverId: '3',
        content: 'test message',
        username: 'demo1'
    });
});

socket.on('receiveMessage', (msg) => {
    console.log("Received:", msg);
    process.exit(0);
});

setTimeout(() => {
    console.log("Timeout! receiveMessage was not called.");
    process.exit(1);
}, 3000);
