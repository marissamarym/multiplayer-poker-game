// server.js
// where your node app starts

///////////////////////
//https://www.npmjs.com/package/btoa
function btoa(str) {
  var buffer;

  if (str instanceof Buffer) {
    buffer = str;
  } else {
    buffer = Buffer.from(str.toString(), 'binary');
  }

  return buffer.toString('base64');
}

//https://stackoverflow.com/questions/6274339/how-can-i-shuffle-an-array
function arrShuffle(a) {
  var j, x, i;
  for (i = a.length - 1; i > 0; i--) {
    j = Math.floor(Math.random() * (i + 1));
    x = a[i];
    a[i] = a[j];
    a[j] = x;
  }
  return a;
}

////////////

var SUIT = ['diamond', 'club', 'heart', 'spade'];
var RANK = [
  'A',
  '2',
  '3',
  '4',
  '5',
  '6',
  '7',
  '8',
  '9',
  '10',
  'J',
  'Q',
  'K',
  'C',
];
var CHIP_DENOMS = ['one', 'five', 'ten', 'twentyfive', 'zero'];
var CHIP_NUMBER = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10'];
var cards = [];
var CARD_WIDTH = 50;
var CARD_HEIGHT = 70;
var CHIP_WIDTH = 20;
var CHIP_HEIGHT = 20;
var WIDTH = 800;
var HEIGHT = 800;

function randId() {
  return btoa(('' + Math.random()).slice(2));
}

function newDeck() {
  var deck = [];

  // Cards
  for (var i = 0; i < 4; i++) {
    for (var j = 0; j < 13; j++) {
      deck.push({
        suit: SUIT[i],
        rank: RANK[j],
        x: 0,
        y: 0,
        z: 0,
        targ: { x: 0, y: 0 },
        resolve_dl: 0,
      });
    }
  }

  // Chips
  for (var i = 0; i < 4; i++) {
    for (var j = 0; j < 10; j++) {
      deck.push({
        suit: CHIP_DENOMS[i],
        rank: CHIP_NUMBER[j],
        x: 0,
        y: 0,
        z: 0,
        targ: { x: 0, y: 0 },
        resolve_dl: 0,
      });
      deck.push({
        suit: CHIP_DENOMS[i],
        rank: CHIP_NUMBER[j],
        x: 0,
        y: 0,
        z: 0,
        targ: { x: 0, y: 0 },
        resolve_dl: 0,
      });
    }
  }
  // Dealer chip
  deck.push({
    suit: CHIP_DENOMS[4],
    rank: CHIP_NUMBER[0],
    x: 0,
    y: 0,
    z: 0,
    targ: { x: 0, y: 0 },
    resolve_dl: 0,
  });
  function makeId(card) {
    return card.suit + '-' + card.rank + '-' + randId();
  }
  for (var i = 0; i < deck.length; i++) {
    deck[i].id = makeId(deck[i]);
  }
  shuffleDeck(deck, true);
  return deck;
}

function isChip(c) {
  return CHIP_DENOMS.includes(c.suit);
}

function shuffleDeck(deck, isFirstShuffle = false) {
  const cards = deck.filter((c) => !isChip(c));
  const chips = deck.filter(isChip);
  deck = arrShuffle(cards);
  if (isFirstShuffle) {
    deck.push(...chips);
    for (var i = 0; i < deck.length; i++) {
      if (isChip(deck[i])) {
        const denomPosition = CHIP_DENOMS.findIndex(
          (item) => item === deck[i].suit
        );
        deck[i].x =
          WIDTH / 2 + CARD_HEIGHT / 2 - 20 + -40 * denomPosition + 200;
        deck[i].y = HEIGHT / 2 + 80;
        deck[i].z = i;
      } else {
        deck[i].x = WIDTH / 2 + 10 + CARD_HEIGHT / 2 + i;
        deck[i].y = HEIGHT / 2 - i;
        deck[i].z = i;
      }
    }
  } else {
    for (var i = 0; i < cards.length; i++) {
      deck[i].x = WIDTH / 2 + 10 + CARD_HEIGHT / 2 + i;
      deck[i].y = HEIGHT / 2 - i;
      deck[i].z = i;
    }
    deck.push(...chips);
  }
}

function getCardById(cards, id) {
  for (var i = 0; i < cards.length; i++) {
    if (cards[i].id == id) {
      return cards[i];
    }
  }
}

////////////////////

var express = require('express');
const _ = require('lodash');
var app = express();
var server = app.listen(process.env.PORT || 300);
app.use(express.static('public'));
console.log('server running');

var io = require('socket.io')(server);

var welcome_messages = [
  'Welcome to The Poker Night App!',
  'Click and drag on a card to move it, or drag a selection to move multiple cards.',
  'Have fun!',
];

var rooms = { lobby: newRoom('lobby') };
serverMessages(rooms.lobby, welcome_messages);

function newRoom(name) {
  const room = {
    name: name,
    messages: [],
    players: {},
    cards: newDeck(),
    empty_time: 0,
  };
  console.log('new room', room);
  return room;
}

function locatePlayer(id) {
  for (var k in rooms) {
    if (id in rooms[k].players) {
      return k;
    }
  }
}

function updateServerData(data) {
  var room = rooms[locatePlayer(data.id)];
  if (room == undefined) {
    console.log('err: player id belongs to no room: ' + data.id);
    return;
  }
  if (data.op == 'movc') {
    console.log('card-move received: ', data);
    for (var i = 0; i < data.cards.length; i++) {
      var cd = getCardById(room.cards, data.cards[i]);
      if (cd == undefined) {
        console.log('err: moving a card that does not exist', data.cards[i]);
        continue;
      }

      cd.x = data.targs[i].x;
      cd.y = data.targs[i].y;
      cd.z = data.targs[i].z;
    }
  } else if (data.op == 'msg') {
    console.log('msg received:', data);
    room.messages.push(data);
  } else if (data.op == 'name') {
    room.players[data.id].name = data.text;
    console.log('set name: ' + data.id + '=' + data.text);
  } else if (data.op == 'room') {
    if (!(data.text in rooms)) {
      rooms[data.text] = newRoom(data.text);
      console.log('new room opened: ' + data.text);
    }
    if (locatePlayer(data.id) != data.text) {
      rooms[data.text].players[data.id] = room.players[data.id];
      delete room.players[data.id];
    }
  } else if (data.op == 'shfl') {
    shuffleDeck(room.cards);
  }
}

function getDataForClient(id) {
  var room = rooms[locatePlayer(id)];
  return Object.assign({}, room, {
    room_list: Object.keys(rooms).slice(0, 32),
  });
}

function maintainRooms() {
  for (var k in rooms) {
    if (Object.keys(rooms[k].players).length == 0) {
      rooms[k].empty_time += 1;
    } else {
      rooms[k].empty_time = 0;
    }
    if (rooms[k].empty_time > 999) {
      console.log('closing room due to inactivity: ', k, rooms[k].empty_time);
      if (k != 'lobby') {
        delete rooms[k];
      } else {
        shuffleDeck(rooms[k].cards, true);
        rooms[k].messages = [];
        rooms[k].empty_time = 0;
        serverMessages(rooms[k], welcome_messages);
        console.log('reset', k, rooms[k].empty_time);
      }
    }
  }
}

function serverMessages(room, msgs) {
  for (var i = 0; i < msgs.length; i++) {
    room.messages.push({
      id: 'server message',
      timestamp: new Date().getTime(),
      name: '',
      text: msgs[i],
    });
  }
}

function newConnection(socket) {
  console.log('new connection: ' + socket.id);
  socket.on('client-start', onClientStart);
  socket.on('client-update', onClientUpdate);
  socket.on('disconnect', onClientExit);

  function onClientStart(data) {
    var added = false;
    var sillyname = socket.id.slice(0, 6);

    if (data.room != undefined) {
      if (!(data.room in rooms)) {
        rooms[data.room] = newRoom(data.room);
      }
      var headcnt = Object.keys(rooms[data.room].players).length;
      if (headcnt < 4) {
        rooms[data.room].players[socket.id] = { name: sillyname, idx: headcnt };
        added = true;
      }
    }
    if (!added) {
      for (var k in rooms) {
        var headcnt = Object.keys(rooms[k].players).length;
        if (headcnt < 4) {
          rooms[k].players[socket.id] = { name: sillyname, idx: headcnt };
          added = true;
          break;
        }
      }
    }
    if (!added) {
      var randname = 'room-' + randId().slice(0, 3);
      while (randname in rooms) {
        randname = 'room-' + randId().slice(0, 3);
      }
      rooms[randname] = newRoom(randname);
      rooms[randname].players[socket.id] = { name: sillyname, idx: 0 };
    }
    var self_id = socket.id;
    var self_socket = socket;
    setInterval(heartbeat, 200);
    function heartbeat() {
      maintainRooms();
      self_socket.emit('server-update', getDataForClient(self_id));
    }
  }

  function onClientUpdate(data) {
    updateServerData(data);
  }

  function onClientExit() {
    var room = rooms[locatePlayer(socket.id)];
    if (room != undefined) {
      delete room.players[socket.id];
    }
    console.log(socket.id + ' disconnected');
  }
}

io.sockets.on('connection', newConnection);
