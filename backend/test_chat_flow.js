const { poolPromise, sql } = require('./db');
const axios = require('axios');
const io = require('socket.io-client');

async function test() {
    try {
        console.log("Adding friend from 2 to 3 (User 2 adds User 3)");
        const r1 = await axios.post('http://localhost:5000/api/friends/request', { requesterId: 2, addresseeId: 3 });
        console.log("R1:", r1.data);
        
        console.log("Adding friend from 3 to 2 (User 3 adds User 2)");
        const r2 = await axios.post('http://localhost:5000/api/friends/request', { requesterId: 3, addresseeId: 2 });
        console.log("R2:", r2.data);
        
        console.log("Checking DB friendships:");
        const pool = await poolPromise;
        const res = await pool.request().query("SELECT * FROM Friendships WHERE (RequesterId=2 AND AddresseeId=3) OR (RequesterId=3 AND AddresseeId=2)");
        console.log(res.recordset);
        
        console.log("Sending a message over socket");
        const socket = io('http://localhost:5000');
        socket.on('connect', () => {
            console.log("Socket connected!");
            socket.emit('sendMessage', { SenderId: 2, ReceiverId: 3, Content: "Hello encrypted text" });
        });
        
        socket.on('receiveMessage', async (msg) => {
            console.log("Received message:", msg);
            socket.disconnect();
            
            console.log("Checking DB messages:");
            const res2 = await pool.request().query("SELECT * FROM Messages");
            console.log(res2.recordset);
            process.exit(0);
        });
    } catch(e) {
        console.error(e.response ? e.response.data : e.message);
        process.exit(1);
    }
}
test();
