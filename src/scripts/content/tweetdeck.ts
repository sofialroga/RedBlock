import { listenExtensionMessages, injectScriptToPage } from './content-common'

listenExtensionMessages(null)

injectScriptToPage('bundled/tweetdeck-inject.bun.js')
