/**
 * Initialize addon on install.
 */
browser.runtime.onInstalled.addListener(()=>{
    //The clientId is the extension instance id, see stateManager.clientId.
    console.log(`Client id: ${stateManager.instanceId()}`)
    stateManager.clearActivePathsRequestId()


})

browser.runtime.onStartup.addListener(async ()=>{

    console.log(`Client id: ${stateManager.instanceId()}`)

    stateManager.clearActivePathsRequestId()

})
