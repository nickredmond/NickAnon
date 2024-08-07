const { GoogleGenerativeAI, HarmBlockThreshold, HarmCategory } = require("@google/generative-ai");
const { XMLParser } = require("fast-xml-parser");
const { v4: uuid } = require('uuid')
const express = require('express')
const mysql = require('mysql2/promise')
const fs = require("fs");
const http = require('http');
const { Server } = require("socket.io");

require('dotenv').config()

const app = express()
const port = process.env.PORT

app.use(express.static('static'))
app.use(express.json())

const server = http.createServer(app);
const io = new Server(server);

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
  'Context: You are a middle-aged father from rural Arkansas with a teenaged son who is battling addiction. You are currently in a recovery meeting for support and to see if you can find useful info to help your son.'
]
const aiUsernames = ['Danny (AI)']

const jokesFeed = [
  `What do you call a boomerang that doesn't come back? 
  A stick.`,
  `What do you call it when a prisoner takes his own mugshot?
  A cellfie.`,
  `What do you call a person with a briefcase in a tree?
  Branch manager.`,
  `What do you call blackbirds that stick together?
  Vel-crows.`,
  `What do you call a policeman in bed?
  An undercover cop.`,
  `Knock! Knock! Who’s there? Alaska. Alaska who? Alaska ‘nother person if you don’t know the answer!`,
  `Knock! Knock! Who’s there? Yoda Lady. Yoda Lady who? Stop yodeling.`,
  `Knock! Knock! Who’s there? Chickens. Chickens who? No, no! Chickens cluck, owls hoo.`,
  `Knock! Knock! Who’s there? Nada. Nada who? Nada another knock-knock joke!`,
  `Knock! Knock! Who’s there? Nanna. Nanna who? Nanna your business.`,
  `Did you hear about the two rowboats that got into an argument? It was an oar-deal.`,
  `Why did the whale blush? It saw the ocean’s bottom.`,
  `Why shouldn't you tell secrets in a cornfield? There are too many ears all around.`,
  `What did the beach say when the tide came in? Long time no sea.`,
  `Why are most people tired on April 1? They've just finished a 31-day March.`,
  `Why can't leopards play hide-and-seek? Because they're always spotted.`,
  `Why did the man bring his watch to the bank? He wanted to save time.`,
  `How do you make a robot angry? Keep pushing his buttons.`,
  `What do you call a happy cowboy? A jolly rancher`,
  `What's the best way to catch a fish? Ask someone to throw it to you.`,
  `What do kids play when they have nothing else to do? Bored games.`,
  `Humpty Dumpty had a great fall. Summer wasn’t too bad either.`,
  `Why did the girl toss a clock out the window? She wanted to see time fly.`,
  `Did you hear about the ice cream truck accident? It crashed on a rocky road.`,
  `What do you call a medieval lamp? A knight light.`,
  `Why can’t you trust a balloon? It’s full of hot air.`,
  `What does a librarian use to go fishing? A bookworm.`,
  `I had a date last night. It was perfect. Tomorrow, I’ll have a grape.`,
  `Why was the traffic light late to work? It took too long to change.`,
  `Why can’t you trust an atom? Because they make up everything.`,
  `Did you hear about the whale that swallowed a clown? It felt funny after.`
]
const quotesFeed = [
  `“Rock bottom became the solid foundation on which I rebuilt my life.” – J.K. Rowling`,
  `“Life is a series of relapses and recoveries.” – George Ade`,
  `“The only person you are destined to become is the person you decide to be.” – Ralph Waldo Emerson`,
  `“Remember that just because you hit bottom doesn’t mean you have to stay there.” – Robert Downey Jr.`,
  `“Life is like riding a bicycle. To keep your balance, you must keep moving.” – Albert Einstein`,
  `“What progress, you ask, have I made? I have begun to be a friend to myself.” – Hecato`,
  `“What makes the desert beautiful is that somewhere it hides a well.” – Antoine de Saint-Exupery`,
  `“The most common way people give up their power is by thinking they don’t have any.” – Alice Walker`,
  `“In the midst of winter, I found there was, within me, an invincible summer. And that makes me happy. For it says that no matter how hard the world pushes against me, within me, there’s something stronger — something better, pushing right back.” – Albert Camus`,
  `“Hardships often prepare ordinary people for an extraordinary destiny.” – C.S. Lewis`,
  `“Every experience in your life is being orchestrated to teach you something you need to know to move forward.” – Brian Tracy`,
  `“Every noble work is at first impossible.” – Thomas Carlyle`,
  `“Don’t judge each day by the harvest you reap but by the seeds that you plant.” – Robert Louis Stevenson`,
  `“What man actually needs is not a tensionless state but rather the striving and struggling for some goal worthy of him.” – Viktor Frankl`,
  `“Experience is not what happens to you, it is what you do with what happens to you.” – Aldous Huxley`,
  `"People become attached to their burdens sometimes more than the burdens are attached to them." - George Bernard Shaw`,
  `"Though no one can go back and make a brand new start, anyone can start from now and make a brand new ending." - Carl Bard`,
  `You cannot solve a problem from the same consciousness that created it. You must learn to see the world anew. – Albert Einstein`,
  `I hated every minute of training, but I said, ‘Don’t quit. Suffer now and live the rest of your life as a champion.’ – Muhammad Ali`,
  `I’ve been absolutely terrified every moment of my life – and I’ve never let it keep me from doing a single thing I wanted to do. – Georgia O’Keeffe`,
  `There are only two ways to live your life. One is as though nothing is a miracle. The other is as though everything is a miracle. – Albert Einstein`,
  `It is only in our darkest hours that we may discover the true strength of the brilliant light within ourselves that can never, ever, be dimmed. — Doe Zantamata`,
  `“Courage isn’t having the strength to go on – it is going on when you don’t have strength.” – Napoleon Bonaparte`,
  `“The ultimate measure of a man is not where he stands in moments of comfort and convenience but where he stands at times of challenge and controversy.” – Dr. Martin Luther King Jr.`,
  `“Expose yourself to your deepest fear; after that, fear has no power.” ~Jim Morrison`,
  `“Not until we are lost we begin to find ourselves.” ~Henry David Thoreau`,
  `“Only in the darkness can you see the stars.” ~Dr. Martin Luther King Jr.`,
  `“The best way to predict your future is to create it.” ~Abraham Lincoln`
]
const philosophyFeed = [
  `Those who cling to perceptions and views will wander the world offending people.`,
  `One moment can change a day, one day can change a life, and one life can change the world.`,
  `We are more often frightened than hurt; and we suffer more in imagination than in reality.`,
  `He who fears death will never do anything worthy of a man who is alive.`,
  `How long are you going to wait before you demand the best for yourself?`,
  `Don’t explain your philosophy. Embody it.`,
  `I begin to speak only when I’m certain what I’ll say isn’t better left unsaid.`,
  `The best revenge is not to be like your enemy.`,
  `In the dance of light and shadow, we find the true essence of balance and harmony.`,
  `There are no greater adversaries than yin and yang, because nothing in Heaven or on Earth escapes them. But it is not yin and yang that do this, it is your heart that makes it so.`,
  `Remember, darkness does not always equate to evil, just as light does not always bring good.`,
  `Knowing others is intelligence; knowing yourself is true wisdom. Mastering others is strength; mastering yourself is true power.`,
  `A man with outward courage dares to die; a man with inner courage dares to live.`,
  `Give evil nothing to oppose and it will disappear by itself.`,
  `To understand the limitation of things, desire them.`,
  `The best time to plant a tree was 20 years ago. The second best time is now.`,
  `The secret of change is to focus all of your energy not on fighting the old, but on building the new. `,
  `Just when the caterpillar thought the world was over, it became a butterfly.`,
  `The diamond cannot be polished without friction, nor the person perfected without trials.`,
  `Fall seven times and stand up eight.`
]

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
      payload: reply
    })
  })
}

let activeUserCount = 0
let messagesSinceReprompt = -1

io.on('connection', (socket) => {
  activeUserCount++
  //todo: emit active user count
  const aiIntroIndex = Math.floor(Math.random() * models.length)
  io.emit('typing', {
    userId: '123',
    username: aiUsernames[aiIntroIndex]
  })
  const introPrompt = `${aiContexts[aiIntroIndex]} Introduce yourself to someone who just joined the meeting.`
  sendAiMessage(introPrompt, aiIntroIndex)
  socket.on('message', (msg) => {
    io.emit('message', msg);
    const aiIndex = Math.floor(Math.random() * models.length)
    const needsReprompt = messagesSinceReprompt >= 10 || messagesSinceReprompt < 0
    const prompt = needsReprompt ? `${aiContexts[aiIndex]} Someone just spoke at the meeting and said: ${msg.payload}` : `Person named ${msg.username} just said: ${msg.payload}`
    sendAiMessage(prompt, aiIndex)
  });
  socket.on('disconnect', () => {
    activeUserCount--
  });
});

let goodNewsArticles = [];
async function getGoodNewsFeed() {
  const response = await fetch('https://www.goodnewsnetwork.org/feed')
  const text = await response.text()
  const parser = new XMLParser();
  const gnnFeed = parser.parse(text)
  let updatedArticles = []
  let index = 0
  do {
    const article = gnnFeed.rss.channel.item[index]
    if (!article.title.toLowerCase().includes('good news in history')) {
      updatedArticles.push(article)
    }
    index++
  } while (updatedArticles.length < 3)
  goodNewsArticles = updatedArticles
}

const oneDay = 1000 * 60 * 60 * 24
setInterval(function() {
  getGoodNewsFeed()
}, oneDay)

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '/static/index.html'));
});

function getNextIndex(lastIndex, length) {
  let nextIndex;
  do {
    nextIndex = Math.floor(Math.random() * length)
  } while (nextIndex === lastIndex)
  return nextIndex
}

//var diffHrs = Math.floor((diffMs % 86400000) / 3600000); // hours
let lastRefreshTime = new Date()
function isRefreshDue(minutes) {
  const now = new Date()
  const diffMs = (now - lastRefreshTime)
  const diffMins = Math.round(((diffMs % 86400000) % 3600000) / 60000);
  return diffMins >= minutes
}

let jokesIndex = -1
let quotesIndex = -1
let philoIndex = -1
app.get('/feed', (req, res) => {
  if (jokesIndex < 0 || isRefreshDue(5)) {
    lastRefreshTime = new Date()
    jokesIndex = getNextIndex(jokesIndex, jokesFeed.length)
    quotesIndex = getNextIndex(quotesIndex, quotesFeed.length)
    philoIndex = getNextIndex(philoIndex, philosophyFeed.length)
  }
  const feed = [
    jokesFeed[jokesIndex],
    quotesFeed[quotesIndex],
    philosophyFeed[philoIndex]
  ]
  res.send(feed)
});

app.get('/gnn', (req, res) => {
  res.send(goodNewsArticles)
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
    const result = await con.query(sql, params || [])
    con.end()
    return result
  } catch(err) {
    console.log('ERROR querying database: ' + err)
    throw err;
  }
}

app.get('/query', (req, res) => {
  const sql = `
  
  `
  queryDb(sql).then(result => {
    console.log('results: ' + JSON.stringify(result))
    res.sendStatus(200).end()
  })
})

getGoodNewsFeed()

server.listen(port, () => {
    console.log(`app listening on port ${port}`)
 })
 