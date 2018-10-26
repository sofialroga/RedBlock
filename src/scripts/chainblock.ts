interface ChainBlockProgress {
  total: number,
  alreadyBlocked: number,
  skipped: number,
  blockSuccess: number,
  blockFail: number
}

const enum ChainBlockUIState {
  Initial,
  Running,
  RateLimited,
  Completed,
  Stopped,
  Closed,
  Error
}

const blocker = new ChainBlocker()

async function doChainBlock (targetUserName: string) {
  const targetUser = await TwitterAPI.getSingleUserByName(targetUserName)
  const confirmMessage = `
ㅁㅁㅁㅁㅁㅁㅁㅁㅁㅁㅁㅁㅁㅁㅁㅁㅁㅁㅁㅁㅁㅁㅁㅁㅁㅁㅁㅁㅁㅁ
정말로 @${targetUserName}에게 체인블락을 실행하시겠습니까?
ㅁㅁㅁㅁㅁㅁㅁㅁㅁㅁㅁㅁㅁㅁㅁㅁㅁㅁㅁㅁㅁㅁㅁㅁㅁㅁㅁㅁㅁㅁ
  `.trim()
  if (window.confirm(confirmMessage)) {
    blocker.add(targetUser)
    blocker.start()
  }
}

browser.runtime.onMessage.addListener((msgobj: object) => {
  const message = msgobj as RBMessage
  switch (message.action) {
    case Action.Start: {
      if (document.querySelector('.mobcb-bg') != null) {
        window.alert('Mirror Of Block 작동중엔 사용할 수 없습니다.')
        return
      }
      void doChainBlock(message.userName)
    } break
  }
})
