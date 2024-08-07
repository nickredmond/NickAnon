const { GoogleGenerativeAI, HarmBlockThreshold, HarmCategory } = require("@google/generative-ai");
const { XMLParser } = require("fast-xml-parser");
const { v4: uuid } = require('uuid')
const express = require('express')
const mysql = require('mysql2/promise')
const fs = require("fs");
const http = require('http');
const { Server } = require("socket.io");
const pantry = require('pantry-node')

require('dotenv').config()

const app = express()
const port = process.env.PORT

app.use(express.static('static'))
app.use(express.json())

const server = http.createServer(app);
const io = new Server(server);

let chatHistory = [];
const pantryClient = new pantry(process.env.PANTRY_KEY)
const options = { parseJSON: true }
pantryClient.basket
  .get('ChatMessages', options)
  .then((contents) => {
    chatHistory = contents.last10
  })

setInterval(function() {
  const last10 = chatHistory.slice(chatHistory.length-10)
  chatHistory = last10
  const options = { parseJSON: true } 
  const payload = { last10 }
  pantryClient.basket
    .update('ChatMessages', payload, options)
    .then((response) => console.log(response))
}, process.env.CHAT_BACKUP_INTERVAL)

const safetySettings = [
  {
    category: HarmCategory.HARM_CATEGORY_HARASSMENT,
    threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
  },
  {
    category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
    threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
  },
  {
    category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
    threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
  },
  {
    category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
    threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
  }
];

const genAI = new GoogleGenerativeAI(process.env.GEMINI_KEY);
// todo: have several of these 
// feed initial prompts 
// then feed user chats as prompts 
// maybe take turns with AIs?

const models = [
  // dad
//  genAI.getGenerativeModel({ model: "gemini-1.5-flash", safetySettings }),
  // therapist in recovery
//  genAI.getGenerativeModel({ model: "gemini-1.5-flash", safetySettings }),
  // young woman in early recovery
  genAI.getGenerativeModel({ model: "gemini-1.5-flash", safetySettings })
]
const aiContexts = [
  'Context: You are a middle-aged father named Danny. You are from rural Arkansas. You have a teenaged son who is battling addiction. You are currently in an online recovery meeting for support and to see if you can find useful info to help your son.'
]
const aiUsernames = ['Danny (AI)']

async function getGeminiOutput(prompt, model) {
  const result = await model.generateContent(prompt);
  const response = await result.response;
  return response.text();
}

function sendAiMessage(prompt, aiIndex) {
  getGeminiOutput(prompt, models[aiIndex])
  .then(reply => {
    io.emit('message', {
      userId: '123',
      username: aiUsernames[aiIndex],
   //  payload: 'Howdy, partner. This is just a placeholder so you dont exceed your limit for the free version of Gemini'
      payload: reply
    })
  })
}

let activeUserCount = 0
let messagesSinceReprompt = -1

io.on('connection', (socket) => {
  activeUserCount++
  //todo: emit active user count
  for (let msg of chatHistory) {
    socket.emit('message', msg)
  }
  const aiIntroIndex = Math.floor(Math.random() * models.length)
  setTimeout(function() {
    io.emit('typing', {
      userId: '123',
      username: aiUsernames[aiIntroIndex]
    })
  }, 100)
  const introPrompt = `${aiContexts[aiIntroIndex]} Introduce yourself to someone who just joined the meeting.`
  sendAiMessage(introPrompt, aiIntroIndex)
  socket.on('message', (msg) => {
    io.emit('message', msg);
    chatHistory.push(msg)
    const aiIndex = Math.floor(Math.random() * models.length)
    const needsReprompt = messagesSinceReprompt >= process.env.AI_REPROMPT_COUNT || messagesSinceReprompt < 0
    const prompt = needsReprompt ? `${aiContexts[aiIndex]} Someone just spoke at the meeting and said: ${msg.payload}` : `Person named ${msg.username} just said: ${msg.payload}`
    sendAiMessage(prompt, aiIndex)
    if (needsReprompt) {
      messagesSinceReprompt = 0
    }
    messagesSinceReprompt++
  });
  socket.on('disconnect', () => {
    activeUserCount--
  });
});

let lastRefreshTime = new Date()
let goodNewsArticles = [];
async function getGoodNewsFeed() {
  lastRefreshTime = new Date()
  console.log('INFO: Fetching news articles from GNN.')
  const response = await fetch('https://www.goodnewsnetwork.org/feed')
  const text = await response.text()
  const parser = new XMLParser();
  const gnnFeed = parser.parse(text)
  let updatedArticles = []
  gnnFeed.rss.channel.item.forEach(article => {
    if (!article.title.toLowerCase().includes('good news in history')) {
      updatedArticles.push(article)
    }
  })
  goodNewsArticles = updatedArticles
}

function isRefreshDue() {
  const now = new Date()
  const diffMs = (now - lastRefreshTime)
  const twoHours = 1000 * 60 * 60 * 2
  return diffMs >= twoHours
}

app.get('/gnn', (req, res) => {
  if (isRefreshDue()) {
    getGoodNewsFeed()
    .then(_ => {
      res.send(goodNewsArticles)
    })
  } else {
    res.send(goodNewsArticles)
  }
});

async function queryDb(sql, params) {
  try {
    const con = await mysql.createConnection({
      host: "mysql-step-14-step-14.d.aivencloud.com",
      port: 28501,
      user: "avnadmin",
      password: process.env.DB_PW,
      database: "defaultdb",
      ssl : {
       ca : fs.readFileSync(__dirname + '/ca-cert.pem')
      }
    });
    const [results] = await con.query(sql, params || [])
    con.end()
    return results
  } catch(err) {
    console.log('ERROR querying database: ' + err)
    throw err;
  }
}

app.get('/feed', (req, res) => {
  const sql = `
    select * from feedItems
    order by RAND()
    limit 10`
  queryDb(sql).then(feed => {
    res.send(feed).end()
  })
});

app.get('/query', (req, res) => {
  const sql = `
  `
  
  queryDb(sql).then(result => {
    console.log('results: ' + JSON.stringify(result))
    res.sendStatus(200).end()
  }) 
})

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '/static/index.html'));
});

getGoodNewsFeed()

server.listen(port, () => {
    console.log(`app listening on port ${port}`)
 })
 