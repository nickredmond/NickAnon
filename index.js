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

const geminiPrompts = [
  [
    'Tell me a dad joke.',
    'Tell me a joke about food.',
    'Tell me a joke.',
    'Tell me a joke relating to the Internet.',
    'Tell me a joke related to addiction recovery.',
    'Tell me a joke about the chicken crossing the road.'
  ],
  [
    'Give me a quote from Brene Brown.',
    'Give me a quote from Tony Robbins.',
    'Give me a quote from Dr. Gabor Maté.',
    'Give me a quote from Bradley Cooper.',
    'Give me a quote from Russel Brand.',
    'Give me a quote from Robert Downey Jr.',
    'Give me a quote from Demi Lovato.'
  ],
  [
    'Give me a quote from the book The Four Agreements.',
    'Give me a quote from the book The Power of Now.',
    'Give me a quote from the book The Alchemist.',
    'Give me a quote from the book Man\s Search for Meaning.',
    'Give me a quote from the book The Subtle Art of Not Giving a F*ck.',
    'Give me a quote from the book The 7 Habits of Highly Effective People.',
    'Give me a quote from the book The Untethered Soul.',
  ],
  [
    'Tell me a knock-knock joke.',
    'Tell me a joke about a dog.',
    'Tell me a witty joke.',
    'Tell me a joke about a car.',
    'Write me a brief stand-up comedy bit.'
  ],
  [
    'Give me a brief reason why I should stay clean and sober.',
    'Give me a brief summary of a benefit I get from staying clean and sober.',
    'Name a way my life will improve if I stay clean and sober.',
    'Tell me what I can do when struggling with thoughts of using an addictive substance.',
    'Tell me about one thing I can do to assure my recovery from addiction.'
  ],
  [
    'Give me a quote from Stoic philosophy.',
    'Give me a quote from Buddhist principles.',
    'Give me a quote about finding harmony.',
    'Give me a quote about striking balance in life.',
    'Give me a quote about perseverance.',
    'Give me a quote about humility.',
    'Give me a philosophic quote.'
  ],
  [
    'Give me a quote from Martin Luther King, Jr.',
    'Give me a quote from Nelson Mandela.',
    'Give me a quote from Jim Carrey.',
    'Give me a quote from Robin Williams.',
    'Give me a quote from Winston Churchill.',
    'Give me a quote from Mahatma Gandhi.',
    'Give me a quote from Albert Einstein.',
    'Give me a quote from FDR.'
  ]
]

async function getGeminiOutput(prompt) {
  const result = await model.generateContent(prompt);
  const response = await result.response;
  return response.text();
}

let geminiOutputs = [];
async function getGeminiOutputs() {
  let updatedOutputs = []
  for (let promptList of geminiPrompts) {
    const prompt = promptList[Math.floor(Math.random() * promptList.length)]
    const output = await getGeminiOutput(prompt)
    updatedOutputs.push(output)
  }
  geminiOutputs = updatedOutputs
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

getGeminiOutputs()
getGoodNewsFeed()

const fifteenMinutes = 1000 * 60 * 15
setInterval(function() {
  getGeminiOutputs()
}, fifteenMinutes)

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

app.get('/gemini', (req, res) => {
  res.send(geminiOutputs)
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
 