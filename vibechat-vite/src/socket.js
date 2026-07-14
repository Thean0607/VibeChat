import { io } from 'socket.io-client';

const URL = `http://${window.location.hostname}:5000`;
export const socket = io(URL, {
    autoConnect: false
});
