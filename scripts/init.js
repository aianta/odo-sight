/**
 * Initialize addon on install.
 */
browser.runtime.onInstalled.addListener(()=>{
    console.log("Generating client id!")
    //Generate a unique clientId.
    stateManager.clientId(crypto.randomUUID())
    stateManager.clearActivePathsRequestId()


})

browser.runtime.onStartup.addListener(async ()=>{

    console.log("Checking for client id...")

    var clientId = await stateManager.exists("clientId")

    if(!clientId){
        console.log("No client id found, generating one now...")
        stateManager.clientId(crypto.randomUUID())
    }else{
        console.log("Client id found!")
    }

    stateManager.clearActivePathsRequestId()

})