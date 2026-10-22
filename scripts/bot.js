
/**
 * Bot mode. Tasks are started and stopped by OdoBot. Turning 'guidanceMode' on makes the background connect OdoX to
 * OdoBot (odoBotSocket.js), so this page only sets the extension up for bot mode.
 */
Promise.all([
    stateManager.boundDispatcher(),
    stateManager.shouldRecord(),
    stateManager.guidanceMode()
]).then(results=>{
    const boundDispatcher = results[0]
    const shouldRecord = results[1]
    const _guidanceMode = results[2]

    console.log(`[bot.js] GuidanceMode: ${_guidanceMode}`)

    if(!_guidanceMode){
        stateManager.guidanceMode(true)
    }

    //Check if the extension is already recording, if not start recording.
    if(!shouldRecord){
        stateManager.set('shouldRecord', true)
    }

    //Check if the bound disbatcher isn't already set to local or realtime
    if(boundDispatcher !== 'local' && boundDispatcher !== 'realtime'){
        stateManager.boundDispatcher('local') //Set it to local
    }

})

//Self-signed ssl check
services.guidanceConnectionCheck().then(
    _=>{console.log('guidanceConnection check done')},
    err=>handleSelfSignedCertificateError(err, services.guidanceConnectionCheck)
)

