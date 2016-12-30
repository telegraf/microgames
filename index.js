const { Composer, Telegram, Markup } = require('micro-bot')
const Router = require('router')
const serveStatic = require('serve-static')
const bodyParser = require('body-parser')
const finalhandler = require('finalhandler')
const url = require('url')
const jws = require('jws')
const { readdirSync, statSync } = require('fs')

const gamesRoot = `${__dirname}/public/games`
const games = readdirSync(gamesRoot).filter((name) => statSync(`${gamesRoot}/${name}`).isDirectory())

// Bot staff
const startMessage = `
*MicroGames* for *MegaFun*

Just tap "Play with friends", then choose a chat and select a game.
`

const inlineAnswer = games.map((game) => {
  return {
    type: 'game',
    id: game,
    game_short_name: game,
    reply_markup: Markup.inlineKeyboard([
      Markup.gameButton('🎮 Play now'),
      Markup.urlButton('⭐️ Rate MicroGames', 'https://telegram.me/storebot?start=microgamesbot')
    ], {columns: 1})
  }
})

const extra = Markup.inlineKeyboard([
  Markup.switchToCurrentChatButton('🎮 Play now', ''),
  Markup.switchToChatButton('🏆 Play with friends', ''),
  Markup.urlButton('⭐️ Rate MicroGames', 'https://telegram.me/storebot?start=microgamesbot')
], { columns: 1 }).extra()

const bot = new Composer()
bot.gameQuery((ctx) => {
  const game = ctx.callbackQuery.game_short_name
  const token = jws.sign({
    header: { alg: 'HS512' },
    payload: {
      game: game,
      user: ctx.from.id,
      imessage: ctx.callbackQuery.inline_message_id,
      message: (ctx.callbackQuery.message || {}).message_id,
      chat: (ctx.chat || {}).id
    },
    secret: process.env.SIGN_SECRET
  })
  return ctx.answerCallbackQuery(null, `${process.env.NOW_URL}/games/${game}/?token=${token}`)
})
bot.on('inline_query', (ctx) => ctx.answerInlineQuery(inlineAnswer))
bot.on('text', (ctx) => ctx.replyWithMarkdown(startMessage, extra))

// HTTP staff
const telegram = new Telegram(process.env.BOT_TOKEN)
const router = Router()
router.use(serveStatic('public'))
const score = router.route('/score')
score.all((req, res, next) => {
  const token = url.parse(req.headers.referer).query.slice(6)
  if (!jws.verify(token, 'HS512', process.env.SIGN_SECRET)) {
    res.statusCode = 403
    return res.end()
  }
  req.microGame = JSON.parse(jws.decode(token).payload)
  next()
})
score.all(bodyParser.json())
score.get((req, res) => {
  const { user, imessage, chat, message } = req.microGame
  telegram.getGameHighScores(user, imessage, chat, message)
    .then((scores) => {
      res.setHeader('content-type', 'application/json')
      res.statusCode = 200
      res.end(JSON.stringify(scores, null, true))
    })
    .catch((err) => {
      console.log(err)
      res.statusCode = 500
      res.end()
    })
})
score.post((req, res) => {
  const scoreValue = parseInt(req.body.score)
  if (scoreValue <= 0) {
    res.statusCode = 400
    return res.end()
  }
  const { user, imessage, chat, message } = req.microGame
  telegram.setGameScore(user, scoreValue, imessage, chat, message, true)
    .then(() => {
      res.statusCode = 200
      res.end()
    })
    .catch((err) => {
      res.statusCode = err.code || 500
      res.end(err.description)
    })
})

module.exports = {
  botHandler: bot,
  requestHandler: (req, res) => router(req, res, finalhandler(req, res))
}
