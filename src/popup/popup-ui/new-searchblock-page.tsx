import * as i18n from '../../scripts/i18n.js'
import * as TextGenerate from '../../scripts/text-generate.js'
import { startNewChainBlockSession } from '../../scripts/background/request-sender.js'
import { MyselfContext, BlockLimiterContext, UIContext } from './contexts.js'
import { UserSearchChainBlockPageStatesContext, PurposeContext } from './ui-states.js'
import {
  BigExecuteChainBlockButton,
  BigExecuteUnChainBlockButton,
  PleaseLoginBox,
  BlockLimiterUI,
  WhatIsBioBlock,
  ChainBlockOptionsUI,
} from './components.js'

const M = MaterialUI
const T = MaterialUI.Typography

function TargetChainBlockOptionsUI() {
  const { targetOptions, mutateOptions } = React.useContext(UserSearchChainBlockPageStatesContext)
  const { myFollowers, myFollowings, includeUsersInBio } = targetOptions
  const userActions: Array<[UserAction, string]> = [
    ['Skip', i18n.getMessage('skip')],
    ['Mute', i18n.getMessage('do_mute')],
    ['Block', i18n.getMessage('do_block')],
  ]
  const bioBlockModes: Array<[BioBlockMode, string]> = [
    ['never', i18n.getMessage('bioblock_never')],
    ['all', i18n.getMessage('bioblock_all')],
    ['smart', i18n.getMessage('bioblock_smart')],
  ]
  return (
    <React.Fragment>
      <M.FormControl component="fieldset">
        <M.FormLabel component="legend">{i18n.getMessage('my_followers')}</M.FormLabel>
        <M.RadioGroup row>
          {userActions.map(([action, localizedAction], index) => (
            <M.FormControlLabel
              key={index}
              control={<M.Radio size="small" />}
              checked={myFollowers === action}
              onChange={() => mutateOptions({ myFollowers: action })}
              label={localizedAction}
            />
          ))}
        </M.RadioGroup>
      </M.FormControl>
      <br />
      <M.FormControl component="fieldset">
        <M.FormLabel component="legend">{i18n.getMessage('my_followings')}</M.FormLabel>
        <M.RadioGroup row>
          {userActions.map(([action, localizedAction], index) => (
            <M.FormControlLabel
              key={index}
              control={<M.Radio size="small" />}
              checked={myFollowings === action}
              onChange={() => mutateOptions({ myFollowings: action })}
              label={localizedAction}
            />
          ))}
        </M.RadioGroup>
      </M.FormControl>
      <br />
      <M.FormControl>
        <M.FormLabel component="legend">
          BioBlock &#x1F9EA; <WhatIsBioBlock />
        </M.FormLabel>
        <M.RadioGroup row>
          {bioBlockModes.map(([mode, localizedMode], index) => (
            <M.FormControlLabel
              key={index}
              control={<M.Radio size="small" />}
              checked={includeUsersInBio === mode}
              onChange={() => mutateOptions({ includeUsersInBio: mode })}
              label={localizedMode}
            />
          ))}
        </M.RadioGroup>
      </M.FormControl>
    </React.Fragment>
  )
}

function TargetUnChainBlockOptionsUI() {
  // const { options, mutateOptions } = props
  const { targetOptions, mutateOptions } = React.useContext(UserSearchChainBlockPageStatesContext)
  const { mutualBlocked } = targetOptions
  const userActions: Array<[UserAction, string]> = [
    ['Skip', i18n.getMessage('skip')],
    ['UnBlock', i18n.getMessage('do_unblock')],
  ]
  return (
    <React.Fragment>
      <M.FormControl component="fieldset">
        <M.FormLabel component="legend">{i18n.getMessage('mutually_blocked')}</M.FormLabel>
        <M.RadioGroup row>
          {userActions.map(([action, localizedAction], index) => (
            <M.FormControlLabel
              key={index}
              control={<M.Radio size="small" />}
              checked={mutualBlocked === action}
              onChange={() => mutateOptions({ mutualBlocked: action })}
              label={localizedAction}
            />
          ))}
        </M.RadioGroup>
      </M.FormControl>
    </React.Fragment>
  )
}

function TargetExecutionButtonUI(props: { isAvailable: boolean }) {
  const { isAvailable } = props
  const { searchQuery, targetOptions } = React.useContext(UserSearchChainBlockPageStatesContext)
  const { purpose } = React.useContext(PurposeContext)
  const { openDialog } = React.useContext(UIContext)
  const uiContext = React.useContext(UIContext)
  const myself = React.useContext(MyselfContext)
  function executeSession(purpose: UserSearchBlockSessionRequest['purpose']) {
    if (!myself) {
      uiContext.openSnackBar(i18n.getMessage('error_occured_check_login'))
      return
    }
    if (!searchQuery) {
      throw new Error('unreachable -- searchQuery is null')
    }
    const request: UserSearchBlockSessionRequest = {
      purpose,
      options: targetOptions,
      target: {
        type: 'user_search',
        query: searchQuery,
      },
      myself,
    }
    openDialog({
      dialogType: 'confirm',
      message: TextGenerate.generateConfirmMessage(request),
      callbackOnOk() {
        startNewChainBlockSession<UserSearchBlockSessionRequest>(request)
      },
    })
  }
  let bigButton: React.ReactNode
  switch (purpose) {
    case 'chainblock':
      bigButton = (
        <BigExecuteChainBlockButton
          disabled={!isAvailable}
          onClick={() => executeSession('chainblock')}
        >
          <span>
            {'\u{1f6d1}'} {i18n.getMessage('execute_chainblock')}
          </span>
        </BigExecuteChainBlockButton>
      )
      break
    case 'unchainblock':
      bigButton = (
        <BigExecuteUnChainBlockButton
          disabled={!isAvailable}
          onClick={() => executeSession('unchainblock')}
        >
          <span>
            {'\u{1f49a}'} {i18n.getMessage('execute_unchainblock')}
          </span>
        </BigExecuteUnChainBlockButton>
      )
      break
  }
  return <M.Box>{bigButton}</M.Box>
}

export default function NewSearchChainBlockPage() {
  const myself = React.useContext(MyselfContext)
  const limiterStatus = React.useContext(BlockLimiterContext)
  function isAvailable() {
    if (!myself) {
      return false
    }
    if (limiterStatus.remained <= 0) {
      return false
    }
    return true
  }
  const { searchQuery } = React.useContext(UserSearchChainBlockPageStatesContext)
  return (
    <div>
      <M.ExpansionPanel defaultExpanded>
        <M.ExpansionPanelSummary>
          <T>{i18n.getMessage('usersearch_chainblock')}</T>
        </M.ExpansionPanelSummary>
        <M.ExpansionPanelDetails>
          {myself ? (
            <div style={{ width: '100%' }}>
              <M.Paper>
                <M.Box padding="10px">
                  <T>
                    {`${i18n.getMessage('query')}: `}
                    <strong>{searchQuery}</strong>
                  </T>
                </M.Box>
              </M.Paper>
              <ChainBlockOptionsUI
                {...{ TargetChainBlockOptionsUI, TargetUnChainBlockOptionsUI }}
              />
              <BlockLimiterUI />
              <TargetExecutionButtonUI isAvailable={isAvailable()} />
            </div>
          ) : (
            <PleaseLoginBox />
          )}
        </M.ExpansionPanelDetails>
      </M.ExpansionPanel>
    </div>
  )
}
