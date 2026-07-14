const fs = require('fs');
const path = require('path');

function replaceInFile(filePath) {
    let content = fs.readFileSync(filePath, 'utf8');
    // For single quotes
    content = content.replace(/'http:\/\/localhost:5000([^']*)'/g, '`http://${window.location.hostname}:5000$1`');
    // For template literals
    content = content.replace(/http:\/\/localhost:5000/g, 'http://${window.location.hostname}:5000');
    
    fs.writeFileSync(filePath, content);
}

replaceInFile(path.join(__dirname, 'src/App.js'));
replaceInFile(path.join(__dirname, 'src/pages/Chat.js'));
replaceInFile(path.join(__dirname, 'src/pages/Login.js'));
replaceInFile(path.join(__dirname, 'src/socket.js'));

console.log("Done");
