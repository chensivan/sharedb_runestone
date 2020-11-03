var http = require('http');
var https = require('https');
var express = require('express');
var ShareDB = require('sharedb');
var WebSocket = require('ws');
var WebSocketJSONStream = require('@teamwork/websocket-json-stream');
var SlackBot = require('slackbots');
var emoji = require('node-emoji');
var marked = require("marked");

const slackBotToken = '';
const slackBotName = 'runestone bot';
const channelName = 'a-project';
const startChat = 'runestone test';

const bot = new SlackBot({
  token: slackBotToken,
  name: slackBotName
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
      channelName,
      startChat,
      params
  );
})

// Message Handler
bot.on('message', (data) => {
  if(data.type !== 'message') {
      return;
  }

  if (data.subtype == 'message_replied') {
    console.log("Receive message from runestone");
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
        doc.data.push(newData);
      }
    }
  }
  else if (data.thread_ts != null && data.subtype == null){
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
          console.log("---------------------Cut-off---------------------")
          var runeDoc = connection.get(doc.data[i].problem_id, 'helpSession');
          runeDoc.fetch(function(err) {
            if (err) throw err;
            var index = 0;
            for (var j = 0; j < runeDoc.data.length; j++) {
              if (runeDoc.data[j].ts == doc.data[i].ts) {
                index = j;
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
                      console.log("Send message from slack");
                      console.log(data);

                      // TODO: link & bold features
                      // Override function
                      const renderer = {
                        em(text) {
                          return `<strong>${text}</strong>`;
                        }, 
                        link(text) {
                          var index = text.indexOf('|');
                          var http = text.substring(0, index);
                          var str = text.substring(index + 1, text.length);
                          return `<a href="${http}">${str}</a>`;
                        }
                      };

                      marked.use({ renderer });
                      var answer = marked.parseInline(emoji.emojify(data.text));
                      if (data.files != undefined){
                        var fileLink = "";
                        for (var i = 0; i < data.files.length; ++i){
                          fileLink += " <a href=" + data.files[i].url_private + " target='_blank'>" + data.files[i].name + "</a> ";
                        }
                        if (data.text == ""){
                          answer = "Check for the uploaded file: " + fileLink;
                        } else {
                          answer = marked.parseInline(emoji.emojify(data.text)) + fileLink;
                        }
                      };
                      console.log(answer);
                      if (answerIndex ==  0) {
                        var newData = {
                          index: answerIndex,
                          user: obj.user.real_name,
                          code: runeDoc.data[index].code,
                          answer: answer,
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
                        answer: answer,
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
