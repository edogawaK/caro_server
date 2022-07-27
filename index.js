const express = require("express");
const uuid = require("uuid");
const cors = require('cors');
const { createServer } = require("http");
const { Server } = require("socket.io");
const { findSourceMap } = require("module");
const app = express();
const httpServer = createServer(app);
app.use(cors())
const io = new Server(httpServer, {
    cors: {
        origin: "*"
    }
});
let waiting = [];
let room = [
    // {
    //     id: '',
    //     user1: '',
    //     user2: '',
    //     data: '',
    //     win: '',
    //     turn: '',
    // }
];
app.get((req, res) => {
    res.send('connected: ' + waiting.length);
});
const rows = 14;
const cols = 14;

function checkRow(row, col, data) {
    let begin = col - 4 >= 0 ? (col - 4) : 0;
    let count = 0;
    while (begin <= col) {
        count = 0;
        for (let i = 0; i <= 4; i++) {
            if (data[row]) {
                count += data[row][begin + i];
            }
        }
        if (count === 5 || count === -5) {
            return true;
        }
        begin++;
    }
    return false;
}
function checkCol(row, col, data) {
    let begin = row - 4 >= 0 ? (row - 4) : 0;
    let count = 0;
    while (begin <= row) {
        count = 0;
        for (let i = 0; i <= 4; i++) {
            if (data[begin + i]) {
                count += data[begin + i][col];
            }
        }
        if (count === 5 || count === -5) {
            return true;
        }
        begin++;
    }
    return false;
}
function checkRight(row, col, data) {
    let beginRow = row - 4 >= 0 ? (row - 4) : 0;
    // let endRow = row + 4 < 10 ? (row + 4) : (10 - 1);
    let beginCol = col - row - beginRow;
    let count = 0;
    while (beginRow <= row) {
        count = 0;
        for (let i = 0; i <= 4; i++) {
            if (data[beginRow + i]) {
                if (data[beginRow + i][beginCol + i]) {
                    count += data[beginRow + i][beginCol + i];
                }
            }
        }
        if (count === 5 || count === -5) {
            return true;
        }
        beginRow++;
        beginCol++;
    }
    return false;
}
function checkLeft(row, col, data) {
    let beginRow = row - 4 >= 0 ? (row - 4) : 0;
    let beginCol = col + row - beginRow;
    let count = 0;
    while (beginRow <= row) {
        count = 0;
        for (let i = 0; i <= 4; i++) {
            if (data[beginRow + i]) {
                if (data[beginRow + i][beginCol - i]) {
                    count += data[beginRow + i][beginCol - i];
                }
            }
        }
        if (count === 5) {
            return true;
        }
        if (count == -5) {
            return true;
        }
        beginRow++;
        beginCol--;
    }
    return false;
}
function checkWin(row, col, data) {
    return checkCol(row, col, data) || checkRow(row, col, data) || checkRight(row, col, data) || checkLeft(row, col, data);
}

function joinRoom(user1, user2, room) {
    user1.join('room_' + room.id);
    user2.join('room_' + room.id);
}
function createRoom(author, manual = false) {
    let data = [];
    for (let i = 0; i < rows; i++) {
        data[i] = [];
        for (let j = 0; j < cols; j++) {
            data[i][j] = 0;
        }
    }
    let newRoom = null;
    if (manual) {
        newRoom = {
            id: room.length,
            user1: author.id,
            user2: null,
            win: null,
            turn: author.id,
            data: data
        };
        author.join('room_' + newRoom.id);
        room.push(newRoom);
    }
    else {
        if (waiting.length) {
            newRoom = {
                id: room.length,
                user1: waiting[0].id,
                user2: author.id,
                win: null,
                turn: waiting[0].id,
                data: data
            };
            author.join('room_' + newRoom.id);
            waiting[0].join('room_' + newRoom.id);
            room.push(newRoom);
            waiting.shift();
        }
        else {
            waiting.push(author);
        }
    }
    return newRoom;
}


function leaveRoom(roomId, userId) {
    let index = room.findIndex((i) => {
        return i.id == roomId;
    });
    let currentRoom = room[index];
    if (currentRoom.user1 == userId) {
        currentRoom.user1 = null;
    }
    if (currentRoom.user2 == userId) {
        currentRoom.user2 = null;
    }
    if (currentRoom.user1 == null && currentRoom.user2 == null) {
        room.splice(index, 1);
    }
}

function leaveWait(userId) {
    let index = waiting.findIndex((i) => {
        return i == userId;
    });
    waiting.splice(index, 1);
}

io.on("connection", (socket) => {

    socket.on('room_wait', (data) => {
        console.log(`${socket.id}: ${data}`);
        let response = createRoom(socket);
        if (!response) {
            socket.emit("game_wait", "waiting");
        }
        else {
            io.sockets.in("room_" + response.id).emit("game_new", response);
        }
    });

    socket.on('room_leave', (data) => {
        leaveRoom(data.id, socket.id);
    });

    socket.on('game_turn', (data) => {
        let currentRoom = room.find((i) => {
            return i.id == data.id;
        });
        if (currentRoom) {
            if (socket.id == currentRoom.turn && !currentRoom.win) {
                let value = currentRoom.turn == currentRoom.user1 ? 1 : -1;
                currentRoom.data[data.row][data.col] = value;
                let win = checkWin(data.row, data.col, currentRoom.data);
                if (win) {
                    currentRoom.win = currentRoom.turn;
                }
                currentRoom.turn = currentRoom.turn == currentRoom.user1 ? currentRoom.user2 : currentRoom.user1;
                io.sockets.in("room_" + currentRoom.id).emit("game_turn", currentRoom);
            }
        }
    })

    socket.on('room_create', (data) => {
        let response = createRoom(socket, true);
        socket.emit('room_create', { id: response.id });
    });

    socket.on('room_join', (id) => {
        let find = room.find(i => i.id == id);
        if (find) {
            find.user2 = socket.id;
            io.sockets.in("room_" + response.id).emit("game_new", response);
        }

    });

    socket.on('game_timeout', (data) => {
        let find = room.find(i => i.id == data.id);
        if (find) {
            find.win = data.user == find.user1 ? find.user2 : find.user1;
            io.sockets.in("room_" + find.id).emit("game_turn", find);
        }
    });

    // socket.emit('game_new',)
    // socket.io('turn');
    //game_new //begin new game
    //game_turn //user play their turn
    //game_win //user win
    //game_again //wan to play again
    //game_accept //accept to play again
    //game_wait

    //room_wait //user find game
    //room_join //user found game
    //room_leave //user leave game
    //room_find //find specific room
    //room_create //create new room and wait
    console.log(`${socket.id} connect`);
    socket.on('disconnect', (socket) => {
        let userId = socket.id;
        let roomId = room.findIndex((i) => {
            if (i.user1 == userId || i.user2 == userId) {
                return true;
            }
            return false;
        })
        leaveRoom(roomId, socket.id);
        leaveWait(userId);
    });
});

httpServer.listen(process.env.PORT || 80);
