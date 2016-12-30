function getTop (cb) {
  var request = new window.XMLHttpRequest()
  request.open('GET', '/score', true)
  request.onload = function () {
    if (request.status >= 200 && request.status < 300) {
      cb(null, JSON.parse(request.responseText))
    } else {
      cb(request.status)
    }
  }
  request.onerror = cb
  request.send()
}

function saveScore (score) {
  var request = new window.XMLHttpRequest()
  request.open('POST', '/score', true)
  request.setRequestHeader('Content-Type', 'application/json; charset=UTF-8')
  request.send('{"score": ' + score + '}')
}

window.MicroGame = {
  getTop: getTop,
  saveScore: saveScore,
  shareScore: function () {
    if (!window.TelegramGameProxy) {
      return console.log("Can't find TelegramGameProxy")
    }
    window.TelegramGameProxy.shareScore()
  }
}
