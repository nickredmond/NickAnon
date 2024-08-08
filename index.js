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
console.log('INFO: preparing to fetch chat history.')
const pantryClient = new pantry(process.env.PANTRY_KEY)
const options = { parseJSON: true }
pantryClient.basket
  .get('ChatMessages', options)
  .then((contents) => {
    console.log(contents)
    chatHistory = contents.last10
  })

setInterval(function() {
  console.log('INFO: Preparing to update chat history.')
  const last10 = chatHistory.slice(chatHistory.length-10)
  chatHistory = last10
  const options = { parseJSON: true } 
  const payload = { last10 }
  pantryClient.basket
    .create('ChatMessages', payload, options)
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
  // dad w/ addicted family
  genAI.getGenerativeModel({ model: "gemini-1.5-flash", safetySettings }),
  // therapist in long-term recovery
  genAI.getGenerativeModel({ model: "gemini-1.5-flash", safetySettings }),
  // young woman in early recovery
  genAI.getGenerativeModel({ model: "gemini-1.5-flash", safetySettings })
]
const aiContexts = [
  'Context: You are a middle-aged father named Danny. You are from rural Arkansas. You have a teenaged son who is battling addiction to alcohol. You are currently in an online recovery meeting for support and to see if you can find useful info to help your son.',
  'Context: You are a licensed therapist named Brad. You have been clean from meth for 8 years, and you go out of your way to help people recover from substance abuse. You are friendly and down-to-earth, and you will also tell people what they need to hear. You are currently in an online recovery meeting to see if you can help anyone.',
  'Context: You are a young woman named Tiffany. You are newly sober after a long period of abusing alcohol. You need all the support you can get, and you are also able to show kindness to the people around. You just found an online recovery meeting and have joined the meeting to seek friendship.'
]
const aiUsernames = [
  'Danny (AI)',
  'Brad (AI)',
  'Tiffany (AI)'
]
const aiUserIds = [
  'ai_danny',
  'ai_brad',
  'ai_tiffany'
]

async function getGeminiOutput(prompt, model) {
  const result = await model.generateContent(prompt);
  const response = await result.response;
  return response.text();
}

function sendAiMessage(prompt, aiIndex) {
  const msg = {
    userId: aiUserIds[aiIndex],
    username: aiUsernames[aiIndex]
  }
  if (process.env.TEST) {
    msg.payload = '[TEST] Howdy, partner. This is just a placeholder so you dont exceed your limit for the free version of Gemini'
    msg.when = new Date()
  } else {
    getGeminiOutput(prompt, models[aiIndex])
    .then(reply => {
      msg.payload = reply
      msg.when = new Date()
      io.emit('message', msg)
      chatHistory.push(msg)
    })
  }
}

function introduceAi(aiIndex) {
  io.emit('typing', {
    userId: aiUserIds[aiIndex],
    username: aiUsernames[aiIndex]
  })
  const introPrompt = `${aiContexts[aiIndex]} Introduce yourself to someone who just joined the meeting.`
  sendAiMessage(introPrompt, aiIndex)
}

function introduceAllAi() {
  const aiIntroIndex = Math.floor(Math.random() * models.length)
  let currentIndex = aiIntroIndex
  let timeout = 500
  do {
    setTimeout(
      introduceAi.bind(null, currentIndex)
    , timeout)
    timeout += 15000
    currentIndex++
    if (currentIndex >= models.length) {
      currentIndex = 0
    }
  } while (currentIndex !== aiIntroIndex)
}

let activeUserCount = 0
let messagesSinceReprompt = [-1, -1, -1]
let isIntroducingAi = false

io.on('connection', (socket) => {
  console.log('INFO: user connected to chat.')
  activeUserCount++
  //todo: emit active user count
  for (let msg of chatHistory) {
    msg.ago = new Date() - new Date(msg.when)
  }
  io.emit('history', chatHistory)
  
  if (!isIntroducingAi) {
    isIntroducingAi = true
    introduceAllAi()
    setTimeout(function() {
      isIntroducingAi = false
    }, 60000)
  }
  
  socket.on('message', (msg) => {
    msg.when = new Date()
    io.emit('message', msg);
    chatHistory.push(msg)
    const isSendingAiMsg = activeUserCount < 2 ? true : Math.random() > 0.5
    if (isSendingAiMsg) {
      const aiIndex = Math.floor(Math.random() * models.length)
      const needsReprompt = messagesSinceReprompt[aiIndex] >= process.env.AI_REPROMPT_COUNT || messagesSinceReprompt[aiIndex] < 0
      const prompt = needsReprompt ? `${aiContexts[aiIndex]} Someone just spoke at the meeting and said: ${msg.payload}` : `Person named ${msg.username} just said: ${msg.payload}`
      sendAiMessage(prompt, aiIndex)
      if (needsReprompt) {
        messagesSinceReprompt[aiIndex] = 0
      }
      messagesSinceReprompt[aiIndex] += 1
    }
  });
  
  socket.on('typing', (usr) => {
    io.emit('typing', usr)
  });
  
  socket.on('disconnect', () => {
    activeUserCount--
    console.log('INFO: user disconnected from chat.')
  });
});

let lastRefreshTime = new Date()
let goodNewsArticles = [];
async function getGoodNewsFeed() {
  if (process.env.TEST) {
    for (let i = 1; i <= 10; i++) {
      goodNewsArticles.push({
        title: '[TEST] This is a fake article',
        link: 'https://goodnewsnetwork.org',
        pubDate: 'Sun, Aug 09 2024',
        description: '<p>This is a placeholder description and means nothing.</p>'
      })
    }
  } else {
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
}

function isRefreshDue() {
  const now = new Date()
  const diffMs = (now - lastRefreshTime)
  const twoHours = 1000 * 60 * 60 * 2
  return diffMs >= twoHours
}

app.get('/gnn', (req, res) => {
  console.log('INFO: request begin for /gnn')
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
  console.log('INFO: preparing to query /feed')
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

/** Initial request from GNN's RSS feed (XML). */
getGoodNewsFeed()

if (process.env.TEST) {
  console.log('WARNING: The app is currently in TEST mode, which means no requests will be made for external data.')
}

server.listen(port, () => {
    console.log(`app listening on port ${port}`)
 })
 