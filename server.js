const http = require('http');
const express = require('express');
const bodyParser = require('body-parser');

let app = express();
const hostname = '127.0.0.1';
const port = process.env.PORT || 3000;
app.use(bodyParser.json()); // support json encoded bodies
app.use(bodyParser.urlencoded({ extended: true })); // support encoded bodies

// const app = http.createServer((req, res) => {
//     res.statusCode = 200;
//     res.setHeader('Content-Type', 'text/plain');
//     res.end('Hello World\n');
// });

app.get('/', function (req, res) {
   res.send('Hello Ro!');
});

let routes = require('./api/routes');
routes(app);

app.listen(port, hostname, () => {
    console.log(`Server running at http://${hostname}:${port}/`);
});