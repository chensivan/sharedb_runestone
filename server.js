var http = require('http');
var https = require('https');
var express = require('express');
var ShareDB = require('sharedb');
var WebSocket = require('ws');
var WebSocketJSONStream = require('@teamwork/websocket-json-stream');
const SlackBot = require('slackbots');
const axios = require('axios');

const slackBotToken = '';
const slackBotChannel = '';

const bot = new SlackBot({
  token: slackBotToken,
  name: slackBotChannel
})

var backend = new ShareDB();
const connection = backend.connect();
const doc = connection.get('timestamp', 'problemid');
var app = express();
createDoc(startServer);

// Create initial document then fire callback
function createDoc(callback) {
  //var connection = backend.connect();
  var doc = connection.get('examples', 'counter');
  doc.fetch(function(err) {
    if (err) throw err;
    if (doc.type === null) {
      doc.create({numClicks: 0}, callback);
      return;
    }
    callback();
  });
}

function startServer() {
  // Create a web server to serve files and listen to WebSocket connections
  app.use(express.static('static'));
  var server = http.createServer(app);

  // Connect any incoming WebSocket connection to ShareDB
  var wss = new WebSocket.Server({server: server});
  wss.on('connection', function(ws) {
    var stream = new WebSocketJSONStream(ws);
    backend.listen(stream);
  });

  server.listen(3000);
console.log('Listening on http://localhost:3000');
}

app.get('/hhh', function(req, res) {
  //var connection = backend.connect();
  var runeDoc = connection.get('ac2_5_1', 'helpSession');
  //var runeDoc = connection.get('examples', 'counter');
  runeDoc.fetch(function(err) {
    if (err) throw err;
    //console.log(runeDoc.data);
    res.send(runeDoc.data);
  });
})

// Start Handler
bot.on('start', () => {
  const params = {
      icon_emoji: ':robot_face:'
  }

  bot.postMessageToChannel(
      'a-project',
      'runestone test',
      params
  );
})

// Message Handler
bot.on('message', (data) => {
  if(data.type !== 'message') {
      return;
  }

  if (data.subtype == 'message_replied') {
    //console.log("message_replied");
    doc.fetch(function(err) {
      if (err) throw err;
      if (doc.type === null) {
        doc.create([], acallback);
      }
      else {
        acallback();
      }
    });
  
    function acallback() {
      var addNew = true;
      for (var i = 0; i < doc.data.length; i++) {
        if (doc.data[i].ts == data.message.ts) {
          addNew = false;
          break;
        }
      }
      if (addNew) {
        var questText = data.message.blocks[4].elements[0].text;
        var newData = {
          ts: data.message.ts,
          problem_id: questText.substring(questText.lastIndexOf("#") + 1, questText.lastIndexOf("|"))
        };
        //console.log(data.message.blocks[4].elements);
        doc.data.push(newData);
      }
    }
  }
  else if (data.thread_ts != null && data.subtype == null){
    //console.log("thread_ts");
    //console.log(data);
    doc.fetch(function(err) {
      if (err) throw err;
      if (doc.type === null) {
        doc.create([], acallback);
      }
      else {
        acallback();
      }
    });

    function acallback() {
      for (var i = 0; i < doc.data.length; i++) {
        if (doc.data[i].ts == data.thread_ts) {
          //console.log(doc.data[i].problem_id);
          var runeDoc = connection.get(doc.data[i].problem_id, 'helpSession');
          runeDoc.fetch(function(err) {
            if (err) throw err;
            var index = 0;
            //console.log('RuneDoc'+runeDoc);
            for (var j = 0; j < runeDoc.data.length; j++) {
              if (runeDoc.data[j].ts == doc.data[i].ts) {
                index = j;
                //console.log('index'+index);
                var answerIndex = runeDoc.data[j].chat.length;

                var options = {
                  host: 'slack.com',
                  path: '/api/users.info?token=' + slackBotToken + '&user=' + data.user + '&pretty=1',
                  method: 'GET'
                };
                
                usercallback = function(response) {
                  var str = '';
                
                  //another chunk of data has been received, so append it to `str`
                  response.on('data', function (chunk) {
                    str += chunk;
                  });
                
                  //the whole response has been received, so we just print it out here
                  response.on('end', function () {
                    var runeDoc = connection.get(doc.data[i].problem_id, 'helpSession');
                    runeDoc.fetch(function(err) {
                      if (err) throw err;
                      var obj = JSON.parse(str);
                      //console.log(obj);
                      //console.log(runeDoc);
                      if (answerIndex ==  0) {
                        var newData = {
                          index: answerIndex,
                          user: obj.user.real_name,
                          code: runeDoc.data[index].code,
                          answer: data.text,
                          pointers: [],
                          likes: [],
                          latestNewCodeIndex: 0,
                          id: String(new Date().getTime()),
                          time: String(new Date().toLocaleTimeString(['en'], {year: '2-digit',  month: 'numeric',  day: 'numeric', hour: '2-digit', minute:'2-digit'}))
                        };
                        runeDoc.data[index].chat.push(newData);
                        answerIndex++;
                      }
                      var latestNewCode = runeDoc.data[index].chat[answerIndex - 1].latestNewCodeIndex;
                      var newData = {
                        index: answerIndex,
                        user: obj.user.real_name,
                        code: null,
                        answer: data.text,
                        pointers: [],
                        likes: [],
                        latestNewCodeIndex: latestNewCode,
                        id: String(new Date().getTime()),
                        time: String(new Date().toLocaleTimeString(['en'], {year: '2-digit',  month: 'numeric',  day: 'numeric', hour: '2-digit', minute:'2-digit'}))
                      };
                      runeDoc.data[index].chat.push(newData);
                      runeDoc.submitOp([{ p: [index],
                        ld: runeDoc.data[index],
                        li: runeDoc.data[index]}]);
                    });
                  });
                }
                https.request(options, usercallback).end();
              }
            }
          });
          break;
        }
      }
    }
  }
  else {
  }
})
