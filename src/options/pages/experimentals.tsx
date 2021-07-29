import React from 'react'
import * as MaterialUI from '@material-ui/core'
import * as i18n from '~~/scripts/i18n'

import { RedBlockOptionsContext } from './contexts'
import { SwitchItem } from '../components'

function checkFirstPartyIsolationSupport() {
  try {
    // 크로미움계열에선 쿠키관련 API 사용시 firstPartyDomain을 사용할 수 없으며, TypeError가 발생한다.
    // 이를 통해 first party isolation 지원여부를 확인한다.
    // @ts-ignore
    chrome.cookies.getAll({ firstPartyDomain: undefined })
    return true
  } catch {
    return false
  }
}

const M = MaterialUI

export default function ExperimentalOptionsPages() {
  const { options, updateOptions } = React.useContext(RedBlockOptionsContext)
  const firstPartyIsolatableBrowser = checkFirstPartyIsolationSupport()
  return (
    <M.Paper>
      <M.Box padding="10px" margin="10px">
        <M.FormControl component="fieldset" fullWidth>
          <M.FormLabel component="legend">실험적 기능 / Experimental features</M.FormLabel>
          <M.Divider />
          <M.FormGroup>
            <SwitchItem
              checked={options.enableBlockBuster}
              label={i18n.getMessage('enable_blockbuster')}
              onChange={checked =>
                updateOptions({
                  enableBlockBuster: checked,
                })
              }
            />
          </M.FormGroup>
          <M.FormHelperText>{i18n.getMessage('blockbuster_description')}</M.FormHelperText>
          <M.Divider variant="middle" />
          <M.FormGroup>
            <SwitchItem
              checked={options.revealBioBlockMode}
              label={i18n.getMessage('enable_bioblock')}
              onChange={checked =>
                updateOptions({
                  revealBioBlockMode: checked,
                })
              }
            />
          </M.FormGroup>
          <M.FormHelperText>{i18n.getMessage('bioblock_description')}</M.FormHelperText>
          <M.Divider variant="middle" />
          <M.FormGroup>
            <SwitchItem
              checked={options.enableReactionsV2Support}
              label={i18n.getMessage('enable_reactions_v2')}
              onChange={checked =>
                updateOptions({
                  enableReactionsV2Support: checked,
                })
              }
            />
          </M.FormGroup>
          <M.FormHelperText>{i18n.getMessage('enable_reactions_v2_description')}</M.FormHelperText>
          <M.Divider variant="middle" />
          <M.FormGroup>
            <SwitchItem
              checked={options.firstPartyIsolationCompatibleMode}
              disabled={!firstPartyIsolatableBrowser}
              label={i18n.getMessage('1st_party_isolation_compatible_mode')}
              onChange={checked =>
                updateOptions({
                  firstPartyIsolationCompatibleMode: checked,
                })
              }
            />
          </M.FormGroup>
          <M.FormHelperText>
            {i18n.getMessage('1st_party_isolation_compatible_mode_description')}
          </M.FormHelperText>
        </M.FormControl>
      </M.Box>
    </M.Paper>
  )
}
