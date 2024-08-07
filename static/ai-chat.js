// self.crypto.randomUUID()

function addMessageBubble(username, message) {
  const msgBubble = document.createElement('div')
  msgBubble.className = 'msg-bubble'
  const meta = document.createElement('p')
  meta.className = 'msg-meta'
  meta.textContent = `${username} (${getCurrentTime()})`
  const contents = document.createElement('p')
  contents.className = 'msg-contents'
  contents.textContent = message
  msgBubble.appendChild(meta)
  msgBubble.appendChild(contents)
  document.getElementById('chat-messages').appendChild(msgBubble)
}

function sendMessage(socket) {
  const payload = document.getElementById('chat-input').value
  if (payload) {
    const username = localStorage.getItem('username')
    addMessageBubble(username, payload)
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
  return new Date().toString()
}

function receiveMessage(msg) {
  const userId = localStorage.getItem('userId')
  if (msg.userId !== userId) {
    addMessageBubble(msg.username, msg.payload)
  }
}

function setTyping(msg) {
  const userId = localStorage.getItem('userId')
  if (msg.userId !== userId) {
    document.getElementById('typing-username').textContent = msg.username
    document.getElementById('typing-indicator').style.display = 'block'
    setTimeout(function() {
      document.getElementById('typing-indicator').style.display = 'none'
    }, 2000)
  }
}