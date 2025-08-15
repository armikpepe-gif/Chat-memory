const http = require('http');

const server = http.createServer((req, res) => {
  res.end('Hello World');
});

server.listen(3000, () => {
  console.log('Server running on port 3000');

  // بعد از 3 ثانیه سرور رو خاموش کن
  setTimeout(() => {
    server.close(() => {
      console.log('Server stopped');
      process.exit(0); // بستن پروسه
    });
  }, 3000);
});
