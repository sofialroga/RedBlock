import { toggleOneClickBlockMode } from '../popup.js'
import * as i18n from '../../scripts/i18n.js'

const M = MaterialUI

export default function MiscPage() {
  return (
    <M.Box padding="10px">
      <M.FormControl component="fieldset">
        <M.FormLabel component="legend">{i18n.getMessage('oneclick_block_mode')}</M.FormLabel>
        <div>
          <M.ButtonGroup variant="contained" color="primary" size="small">
            <M.Button onClick={() => toggleOneClickBlockMode(true)}>
              <span>ON</span>
            </M.Button>
            <M.Button onClick={() => toggleOneClickBlockMode(false)}>
              <span>OFF</span>
            </M.Button>
          </M.ButtonGroup>
        </div>
      </M.FormControl>
    </M.Box>
  )
}
