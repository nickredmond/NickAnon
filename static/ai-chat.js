function addMessageBubble(msg, isSelf) {
  const msgBubble = document.createElement('div')
  msgBubble.className = 'msg-bubble'
  if (isSelf) {
    msgBubble.style.backgroundColor = '#aaffaa'
  }
  const nameField = document.createElement('p')
  nameField.className = 'msg-name'
  nameField.textContent = msg.username
  const ago = msg.ago || 0
  const when = timeago(ago) 
  const timeField = document.createElement('p')
  timeField.className = 'msg-time'
  timeField.textContent = when
  const contents = document.createElement('p')
  contents.className = 'msg-contents'
  contents.textContent = msg.payload
  msgBubble.appendChild(nameField)
  msgBubble.appendChild(timeField)
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
    const userId = localStorage.getItem('userId')
    const message = {username,userId,payload}
    addMessageBubble(message, true)
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

function receiveMessage(msg, isHistory) {
  const userId = localStorage.getItem('userId')
  const isSelf = msg.userId === userId
  if (!isSelf || isHistory) {
    document.getElementById('typing-indicator').style.display = 'none'
    addMessageBubble(msg, isSelf)
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