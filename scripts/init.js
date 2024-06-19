/**
 * Initialize addon on install.
 */
browser.runtime.onInstalled.addListener(()=>{

    //Generate a unique clientId.
    stateManager.clientId(crypto.randomUUID())
    stateManager.clearActivePathsRequestId()


})