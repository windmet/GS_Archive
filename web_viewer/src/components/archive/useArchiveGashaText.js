import {uiLocale} from '../../localization/ui/UiLocaleStore.js'
import {translatedGashaName} from '../../data/gashaTicketCatalog.js'
export const gashaText=source=>translatedGashaName(source,uiLocale.value)
