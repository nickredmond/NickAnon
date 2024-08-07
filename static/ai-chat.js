// self.crypto.randomUUID()

function addMessageBubble(username, message, isSelf) {
  const msgBubble = document.createElement('div')
  msgBubble.className = 'msg-bubble'
  if (isSelf) {
    msgBubble.style.backgroundColor = '#aaffaa'
  }
  const meta = document.createElement('p')
  meta.className = 'msg-meta'
  meta.textContent = `${username} - ${getCurrentTime()}`
  const contents = document.createElement('p')
  contents.className = 'msg-contents'
  contents.textContent = message
  msgBubble.appendChild(meta)
  msgBubble.appendChild(contents)
  const conversation = document.getElementById('chat-messages')
  conversation.appendChild(msgBubble)
  window.scrollTo(0, conversation.offsetHeight)
}

function sendMessage(socket) { 
  const input = document.getElementById('chat-input')
  const payload = input.value
  if (payload) {
    input.value = ''
    const username = localStorage.getItem('username')
    addMessageBubble(username, payload, true)
    const userId = localStorage.getItem('userId')
    const message = {username,userId,payload}
    socket.emit('message', message)
  }
}

let canSendTyping = true

function sendTyping(socket) {
  if (canSendTyping) {
    canSendTyping = false
    const username = localStorage.getItem('username')
    const userId = localStorage.getItem('userId')
    socket.emit('typing', {username,userId})
    setTimeout(function() {
      canSendTyping = true
    }, 1000)
  }
}

function getCurrentTime() {
  const now = new Date()
  let hours = now.getHours()
  const ampm = hours > 11 ? 'p' : 'a'
  if (hours > 12) {
    hours -= 12
  }
  if (hours < 10) {
    hours = '0' + hours
  }
  let minutes = now.getMinutes()
  if (minutes < 10) {
    minutes = '0' + minutes
  }
  return `${hours}:${minutes}${ampm}`
}

function receiveMessage(msg) {
  const userId = localStorage.getItem('userId')
  if (msg.userId !== userId) {
    document.getElementById('typing-indicator').style.display = 'none'
    addMessageBubble(msg.username, msg.payload)
  }
}

function setTyping(msg) {
  const userId = localStorage.getItem('userId')
  if (msg.userId !== userId) {
    document.getElementById('typing-username').textContent = msg.username
    document.getElementById('typing-indicator').style.display = 'block'
    const conversation = document.getElementById('chat-messages')
    window.scrollTo(0, conversation.offsetHeight + 40)
    setTimeout(function() {
      document.getElementById('typing-indicator').style.display = 'none'
    }, 2000)
  }
}