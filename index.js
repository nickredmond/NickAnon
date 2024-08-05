const { GoogleGenerativeAI, HarmBlockThreshold, HarmCategory } = require("@google/generative-ai");
const { XMLParser } = require("fast-xml-parser");
const express = require('express')
const fs = require("fs");

require('dotenv').config()

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
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash", safetySettings });

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
  `Knock! Knock! Who’s there? Nanna. Nanna who? Nanna your business.`
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
  `“Hardships often prepare ordinary people for an extraordinary destiny.”– C.S. Lewis`,
  `“Every experience in your life is being orchestrated to teach you something you need to know to move forward.” – Brian Tracy`,
  `“Every noble work is at first impossible.” – Thomas Carlyle`,
  `“Don’t judge each day by the harvest you reap but by the seeds that you plant.” – Robert Louis Stevenson`
]
const philosophyFeed = [
  `Those who cling to perceptions and views will wander the world offending people.`,
  `One moment can change a day, one day can change a life, and one life can change the world.`
]

async function getGeminiOutput(prompt) {
  const result = await model.generateContent(prompt);
  const response = await result.response;
  return response.text();
}

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

getGoodNewsFeed()

const oneDay = 1000 * 60 * 60 * 24
setInterval(function() {
  getGoodNewsFeed()
}, oneDay)

const app = express()
const port = process.env.PORT

app.use(express.static('static'))
app.use(express.json())

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '/static/index.html'));
});

app.get('/feed', (req, res) => {
  const feed = [
    jokesFeed[Math.floor(Math.random() * jokesFeed.length)],
    quotesFeed[Math.floor(Math.random() * jokesFeed.length)],
    philosophyFeed[Math.floor(Math.random() * jokesFeed.length)]
  ]
  res.send(feed)
});

app.get('/gnn', (req, res) => {
  res.send(goodNewsArticles)
});

app.post('/question', (req, res) => {
  let prompt = 'Act like you are '
  switch (req.body.role) {
    case 'researcher':
      prompt += 'an addiction researcher and you have been in the field for 25 years, '
      break;
    case 'therapist':
      prompt += 'an addiction therapist and you have been sober for 8 years, '
      break;
    case 'friend':
      prompt += 'my closest friend and you have a brother in recovery from addiction, '
      break;
    case 'mother':
      prompt += 'my mother and you are willing to help however you can but you won\'t enable me, '
      break;
  }
  prompt += `while you answer the following question: ${req.body.question}`
  getGeminiOutput(prompt)
  .then(answer => {
    res.send({answer})
  })
})

app.listen(port, () => {
    console.log(`app listening on port ${port}`)
 })
 