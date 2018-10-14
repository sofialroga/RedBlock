interface ChainBlockFilter {
  followers: boolean,
  followings: boolean,
}

interface ChainBlockerProgressState {
  total: number,
  alreadyBlocked: number,
  skipped: number,
  blockSuccess: number,
  blockFail: number
}

async function asyncCollect<T> (gen: AsyncIterableIterator<T>) {
  const result: T[] = []
  for await (const item of gen) {
    result.push(item)
  }
  return result
}

class ChainBlocker {
  private ui = new ChainBlockUI
  constructor () {}
  async start (targetUserName: string) {
    const ui = this.ui
    const targetUser = await TwitterAPI.getSingleUserByName(targetUserName)
    ui.updateTarget(targetUser)
    const progress: ChainBlockerProgressState = {
      total: targetUser.followers_count,
      alreadyBlocked: 0,
      skipped: 0,
      blockSuccess: 0,
      blockFail: 0,
    }
    for await (const user of TwitterAPI.getAllFollowers(targetUserName)) {
      if (user === 'RateLimitError') {
        TwitterAPI.getRateLimitStatus().then((limits: LimitStatus) => {
          const followerLimit = limits.followers['/followers/list']
          ui.rateLimited(followerLimit)
        })
        const second = 1000
        const minute = second * 60
        await sleep(2 * minute)
        continue
      }
      ui.rateLimitResetted()
      if (user.blocking) {
        ++progress.alreadyBlocked
        ui.updateProgress(Object.assign({}, progress))
        continue
      }
      const following = user.following
      const followedBy = user.followed_by
      const followRequesting = user.follow_request_sent
      const followSkip = _.some([following, followedBy, followRequesting])
      if (followSkip) {
        ++progress.skipped
        ui.updateProgress(Object.assign({}, progress))
        continue
      }
      // console.warn('WARNING: fake block!')
      // TODO: implement block, real block
      const blockResult = Math.random() * 10 > 2
      if (blockResult) {
        ++progress.blockSuccess
        ui.updateProgress(Object.assign({}, progress))
      } else {
        ++progress.blockFail
        ui.updateProgress(Object.assign({}, progress))
      }
    }
  // 필요한 것:
  // - "내"* <- 나 자신의 정보
  // - 내 팔로워
  // - 내 팔로잉
  // - ...기존차단여부? (근데 체인블락 많이 돌리면 이게 느릴 듯)
  }
}


function shouldBlock(user: TwitterUser): boolean {
  const reasons = [
    user.blocking, // 이미 차단함
    user.following, // 내가 팔로우중
    user.followed_by, // 나를 팔로우함
    user.follow_request_sent // (프로텍트 계정의 경우) 팔로우 신청 대기 중. (팔로우중으로 취급)
  ]
  return !(reasons.some(t => t))
}
