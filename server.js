const http      = require('http');
const url       = require('url');
// const EventEmitter = require('events');
// const emiter    = new EventEmitter();
const requestIp = require('request-ip')
const server    = require('ws');
const ws        = new server.Server({noServer:true});
const mysql     = require('mysql');
let clients     = new Set();
let db          = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'chatws'
});

db.connect(function(err) {
    if (err) throw err;
    console.log("Connected!");
});


let headers = {
    'Content-Type': 'text/html',
    'Access-Control-Allow-Origin': '*'
};

const decode_url = (urls) => {
    let search = urls.split('?')[1];
    let the_url = JSON.parse('{"' + decodeURI(search)
                        .replace(/"/g, '\\"').replace(/&/g, '","')
                        .replace(/=/g, '":"') + '"}'
    );

    return the_url;
};

function handleLogin(req, res) {
    let client_ip       = requestIp.getClientIp(req);
    let result_decode   = decode_url(req.url);
    let username        = result_decode?.username ? result_decode?.username : '';
    let pass            = result_decode?.password ? result_decode?.password : '';

    let query = `SELECT * FROM tb_users WHERE username='${username}' AND password='${pass}' LIMIT 1`; 
    db.query(query, function(err, result, fields) {
        if(err) throw err;
        if(result?.length != 0) {
            res.writeHead(200, headers);
            res.write(JSON.stringify({
                username: result[0].username,
                code: result[0].code,
                // password: pass,
                ip_address: result[0].ip_address,
                status: true
            }));
            res.end();

            // update user ip, if login in other device
            if(client_ip != result[0].ip_address) {
                db.query(`UPDATE tb_users SET ip_address='${client_ip}' WHERE id=${result[0].id}`, function(err, result, fields) {
                    if(err) throw err;
                });
            }

        } else {
            res.writeHead(200, headers);
            res.write(JSON.stringify({
                status: false
            }));
            res.end();
        }
    });
}

function onSocketConnect(ws, request) {
    let search = request.url.split('?')[1];
    let params = JSON.parse('{"' + decodeURI(search)
                        .replace(/"/g, '\\"').replace(/&/g, '","')
                        .replace(/=/g, '":"') + '"}'
    );
                        
    clients.add({
        c_srv: ws,
        c_id: params.client_id
    });
  
    // if()
    ws.on('message', function(message) {
        console.log("receive: %s", message);
        let c_req = JSON.parse(message); 

        for(let client of clients) {
            if(client.c_id == c_req.to) {
                //Handle penerima
                console.log("receive message from client: %s", c_req.from);
                client.c_srv.send(JSON.stringify(c_req));
            }

            if(client.c_id == c_req.from && c_req.message != '') {
                //Handle pengirim
                console.log("send message to client: %s", c_req.to);
                client.c_srv.send(JSON.stringify(c_req));
            }
        }
    })
}

http.createServer((req, res) => {
    const urls = url.parse(req.url)
    if(urls.pathname == '/login') {
        console.log("Client " + requestIp.getClientIp(req) + " request to login");
        handleLogin(req, res);
        
    }else if(urls.pathname == '/connect' && req.headers?.upgrade.toLowerCase() == 'websocket') {
        console.log("Client " + requestIp.getClientIp(req) + " request to connect");
        ws.handleUpgrade(req, req.socket, Buffer.alloc(0), onSocketConnect);
    }
}).listen(8080);

// function genereateCode() {
//     var length = 10,
//         charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789",
//         retVal = "#";
//     for (var i = 0, n = charset.length; i < length; ++i) {
//         retVal += charset.charAt(Math.floor(Math.random() * n));
//     }
//     return retVal;
// }