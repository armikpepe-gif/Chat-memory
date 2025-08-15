const fs = require('fs');
const path = require('path');
const express = require('express');
const bodyParser = require('body-parser');

const app = express();
const PORT = process.env.PORT || 3000;

// مسیر فایل حافظه
const memoryFile = path.join(__dirname, 'memory.json');

// تابع خواندن حافظه
function readMemory() {
    try {
        const data = fs.readFileSync(memoryFile, 'utf8');
        return JSON.parse(data);
    } catch (err) {
        return { messages: [] };
    }
}

// تابع ذخیره حافظه
function saveMemory(memory) {
    fs.writeFileSync(memoryFile, JSON.stringify(memory, null, 2));
}

app.use(bodyParser.json());

// دریافت تمام پیام‌ها
app.get('/messages', (req, res) => {
    const memory = readMemory();
    res.json(memory);
});

// افزودن پیام جدید
app.post('/messages', (req, res) => {
    const { user, text } = req.body;
    if (!user || !text) {
        return res.status(400).json({ error: 'User and text are required' });
    }

    const memory = readMemory();
    const message = { user, text, time: new Date().toISOString() };

    memory.messages.push(message);
    saveMemory(memory);

    res.json({ success: true, message });
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
