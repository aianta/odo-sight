Promise.all([
    stateManager.boundDispatcher(),
    stateManager.shouldRecord()
]).then(results=>{
    const boundDispatcher = results[0]
    const shouldRecord = results[1]

    //Check if the extension is already recording, if not start recording. 
    if(!shouldRecord){
        stateManager.set('shouldRecord', true)
    }

    //Check if the bound disbatcher isn't already set to local or realtime
    if(boundDispatcher !== 'local' && boundDispatcher !== 'realtime'){
        stateManager.boundDispatcher('local') //Set it to local
    }

})



