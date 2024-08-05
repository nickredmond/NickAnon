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
  A stick.`
]
const quotesFeed = [
  `“Rock bottom became the solid foundation on which I rebuilt my life.” – J.K. Rowling`
]
const philosophyFeed = [
  `Those who cling to perceptions and views wander the world offending people.`
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
  let prompt = 'Assume the role of '
  switch (req.body.role) {
    case 'researcher':
      prompt += 'an addiction researcher who\'s been in the field for 25 years, '
      break;
    case 'therapist':
      prompt += 'an addiction therapist who has been sober for 8 years, '
      break;
    case 'friend':
      prompt += 'my closest friend who has a brother in recovery from addiction, '
      break;
    case 'mother':
      prompt += 'my mother who is willing to help however she can but won\'t enable me, '
      break;
  }
  prompt += `while you answer the following question: ${req.body.question}`
  const answer = getGeminiOutput(prompt)
  res.send({answer})
})

app.listen(port, () => {
    console.log(`app listening on port ${port}`)
 })
 