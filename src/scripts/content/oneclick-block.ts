import * as i18n from '~~/scripts/i18n'
import { blockUser, toastMessage } from './content-common'

const setOfBadWords: BadWordItem[] = []

function loadBadWords(badWords: BadWordItem[]) {
  setOfBadWords.length = 0
  setOfBadWords.push(...badWords)
}

browser.storage.local.get('badWords').then(storage => {
  const { badWords } = storage as unknown as Partial<RedBlockStorage>
  loadBadWords(badWords || [])
})

browser.storage.onChanged.addListener(changes => {
  if (!changes.badWords) {
    return
  }
  const newBadWords = changes.badWords.newValue as BadWordItem[]
  loadBadWords(newBadWords || [])
})

function checkBadWord(text: string): BadWordItem | null {
  for (const badWord of setOfBadWords) {
    if (!badWord.enabled) {
      continue
    }
    if (badWord.regexp) {
      const pattern = new RegExp(badWord.word, 'i')
      if (pattern.test(text)) {
        return badWord
      }
    } else {
      const loweredText = text.toLowerCase()
      const loweredWord = badWord.word.toLowerCase()
      if (loweredText.includes(loweredWord)) {
        return badWord
      }
    }
  }
  return null
}

function checkBadWordFromUserProfile({
  description,
  name,
  screen_name,
}: TwitterUser): BadWordItem | null {
  const textsToFind = [description, name, screen_name]
  for (const text of textsToFind) {
    const bw = checkBadWord(text)
    if (bw) {
      return bw
    }
  }
  return null
}

function markUser(detail: MarkUserParams) {
  const event = new CustomEvent<MarkUserParams>('RedBlock->MarkUser', {
    detail,
  })
  document.dispatchEvent(event)
  const { userId, userAction } = detail
  if (userAction === 'Block') {
    const oneclickButtons = document.querySelectorAll(`[data-redblock-btn-user="${userId}"]`)
    oneclickButtons.forEach(button => button.remove())
  }
}

export async function unblockUserById(userId: string) {
  return browser.runtime.sendMessage<RBMessageToBackground.UnblockUserById>({
    messageType: 'UnblockUserById',
    messageTo: 'background',
    userId,
  })
}

export function generateBlockButton(user: TwitterUser): HTMLButtonElement {
  const btn = document.createElement('button')
  btn.type = 'button'
  btn.className = 'redblock-btn redblock-block-btn'
  btn.textContent = i18n.getMessage('block')
  btn.title = `[Red Block] ${i18n.getMessage('block_xxx', user.screen_name)}`
  const badWordCheckResult = checkBadWordFromUserProfile(user)
  if (badWordCheckResult) {
    btn.className += ' suggested'
    btn.title += '\n'
    btn.title += i18n.getMessage('user_profile_contains', badWordCheckResult.word)
  } else {
    btn.className += ' manual'
  }
  btn.setAttribute('data-redblock-btn-user', user.id_str)
  btn.addEventListener('click', event => {
    event.preventDefault()
    blockUser(user)
    user.blocking = true
    markUser({
      userAction: 'Block',
      userId: user.id_str,
    })
    toastMessage({
      text: `[Red Block] ${i18n.getMessage('blocked_xxx', user.screen_name)}`,
      undoBlock: { userId: user.id_str, userName: user.screen_name },
    })
  })
  return btn
}

export function shouldSkip(user: TwitterUser) {
  return user.following || user.follow_request_sent || user.blocking
}
