const fs = require('fs');

function updateFile(file) {
    if (!fs.existsSync(file)) return;
    let content = fs.readFileSync(file, 'utf8');
    
    // Replace URL constant
    content = content.replace('const URL = `http://${window.location.hostname}:5000`;', 'const URL = ``;');
    
    // Replace all instances
    const searchStr = 'http://${window.location.hostname}:5000';
    content = content.split(searchStr).join('');
    
    fs.writeFileSync(file, content);
    console.log('Updated', file);
}

['src/socket.js', 'src/pages/Chat.jsx', 'src/pages/Login.jsx', 'src/App.jsx'].forEach(updateFile);
