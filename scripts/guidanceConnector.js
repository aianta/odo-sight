/*
    Dispatcher component from LogUI Client, hacked apart by Alexandru Ianta for use in odo-sight.
    The Local Dispatcher stores events locally in the extension's storage. It is used for passive recording 
    of recent user interaction events that are later used to locate the user in the odo-bot application model when 
    the user asks for help.  


    Original header comment below:
------------------------------------------------------------
    LogUI Client Library
    WebSocket-based Dispatcher

    A WebSocket-based dispatcher that communicates with a LogUI server implementation.

    @module: WebSocket-based Dispatcher
    @author: David Maxwell
    @date: 2021-03-08
*/


var GuidanceConnector = (function() {
    var _public = {};
    var _isActive = false;
    var _cacheSize = 2500 // The maximum number of stored events that can be in the cache before flushing.
    var _libraryLoadTimestamp = null;  // The time at which the dispatcher loads -- for measuring the beginning of a session more accurately.
    var _sessionID = null;
    var _sessionStartTimestamp = null;
    var _libraryStartTimestamp = null;
    var _cache = [];
    var _transmit = false;
    var _seq = 0; //The number of the next event sent to OdoBot. OdoBot detects lost events by gaps in these numbers.


    _public.dispatcherType = 'guidance';

    /**
     * Captures the visible part of the active tab of the current window.
     * @returns {Promise<{screenshot: string, url: string}>} the screenshot as a base64 encoded PNG, and the tab's url as shown in the
     * address bar.
     */
    var _captureActiveTab = async function(){
        const currentWindow = await browser.windows.getCurrent({populate: true})
        const imageUrl = await browser.tabs.captureVisibleTab(currentWindow.id, {format: 'png'})
        const imageBytes = await fetch(imageUrl).then(response=>response.arrayBuffer())
        const activeTab = currentWindow.tabs.find(tab=>tab.active)
        return {
            screenshot: new Uint8Array(imageBytes).toBase64(),
            url: activeTab?.url
        }
    }

    /**
     * Whether an event gets a screenshot: interaction events, and TinyMCE edits, which LogUI sends as INPUT_CHANGE custom events.
     */
    var _hasScreenshot = function(objectToSend){
        if(objectToSend.eventType === 'interactionEvent'){
            return true
        }
        const details = objectToSend.eventDetails
        return objectToSend.eventType === 'customEvent' && details?.name === 'INPUT_CHANGE' && details?.source === 'tinyMCE'
    }

    /**
     * The 'event' channel of OdoX's socket to OdoBot, see odoBotSocket.js.
     */
    var eventChannel = {
        sendEvent: async function(event){
            const pathsRequestId = await stateManager.activePathsRequestId()
            //Numbered as it is sent, so the numbers follow the order OdoBot receives events in.
            OdoBotSocket.send('event', 'EVENT', {
                seq: _seq++,
                pathsRequestId: pathsRequestId,
                event: event
            })
        },
        onMessage: async function(data){
            console.log(`[guidanceConnector.js] Event channel got ${data.type}`)
            switch(data.type){
                case "GET_SCREENSHOT":

                    //OdoBot asks for a screenshot once the page has settled after an uncharted step.
                    _captureActiveTab()
                        .then(({screenshot, url})=>{
                            OdoBotSocket.reply(data, 'SCREENSHOT', {
                                screenshot: screenshot,
                                userLocation: url
                            })
                        })
                        .catch(err=>console.error("[guidanceConnector.js] Failed to capture a screenshot", err))


                    break;
                case "PATH_COMPLETE":

                    await stateManager.shouldTransmit(false)
                    await stateManager.clearActivePathsRequestId()

                    OdoBotSocket.reply(data, 'PATH_COMPLETE_ACK')

                    break
                case "START_TRANSMISSION":
                    /**
                     * To allow the server to initiate requests we need to be able to set the activePathsRequestId from
                     * a server given value. This has to happen before any event is sent, since sending an event reads it.
                     */
                    if(!await stateManager.exists('activePathsRequestId')){
                        await stateManager.activePathsRequestId(data['pathsRequestId'])
                    }

                    /**
                     * The first event the server receives after transmission starts is an Observation of the page. The tab is
                     * captured first. Then queueing the Observation, clearing the cache and switching transmission on happen in
                     * one synchronous step, so no event is sent ahead of the Observation.
                     */
                    const observation = await _captureActiveTab()
                        .then(({screenshot, url})=>_public.packageObservation(url, screenshot))
                        .catch(err=>{
                            console.error("[guidanceConnector.js] Failed to capture the tab for the Observation", err)
                            return _public.packageObservation(undefined, undefined)
                        })
                    _seq = 0 //The events of a transmission are numbered from 0, starting with the Observation.
                    const observationSent = eventChannel.sendEvent(observation)
                        .catch(err=>console.error("[guidanceConnector.js] Failed to send the Observation", err))
                    _cache = [] //Events recorded before transmission started are not sent.
                    _transmit = true
                    await stateManager.shouldTransmit(true)

                    const startedPathsRequestId = await stateManager.activePathsRequestId()

                    await observationSent

                    console.log("Sending transmission started confirmation!")

                    OdoBotSocket.reply(data, 'TRANSMISSION_STARTED', {pathsRequestId: startedPathsRequestId})
                    break
                case "STOP_TRANSMISSION":
                    _transmit = false
                    await stateManager.shouldTransmit(false)

                    OdoBotSocket.reply(data, 'TRANSMISSION_STOPPED', {pathsRequestId: await stateManager.activePathsRequestId()})
                    break
            }

        }
    }


    _public.init = function() {
        _cache = [];
        _isActive = true;

        const sessionData = {
            sessionID: crypto.randomUUID(),
            fresh: true,
            sessionStartTimestamp: Date.now(),
            libraryStartTimestamp: Date.now()
        }
        

        _sessionID = sessionData.sessionID;

        return stateManager.sessionId(sessionData.sessionID)
        .then(_=>stateManager.sessionData(sessionData)
        .then(_=>stateManager.sessionReady(true)))
        .then(_=>console.log(`Session data set up! ${sessionData}`))
        
    };

    _public.stop = async function() {
        _cache = [];
        _isActive = false;
        _sessionID = null;
        
    };

    _public.isActive = function() {
        return _isActive !== null && _isActive
    };

    _public.sendObject = function(objectToSend) {
        console.log('got send object')

        if(objectToSend.sessionID === _sessionID){

            if(_transmit){
                
                //Capture a screenshot for interaction events and TinyMCE edits.
                if(_hasScreenshot(objectToSend)){
                    _captureActiveTab()
                    .then(({screenshot})=>{
                        objectToSend.eventDetails.screenshot = screenshot
                    })
                    .catch(err=>console.error("[guidanceConnector.js] Failed to capture a screenshot, sending the event without one", err))
                    .then(()=>eventChannel.sendEvent(objectToSend))
                }else{
                    eventChannel.sendEvent(objectToSend)
                }

                
            }else{
                _cache.push(objectToSend);
                console.log("cache size: ", _cache.length)

                if (_cache.length >= _cacheSize) {
                    _cache.shift()
                }
            }

            return;
        }
      


        //throw Error('You cannot send a message when LogUI is not active.');
    };

    var _getMessageObject = function(messageType, payload) {
        return {
            sender: 'logUIClient',
            type: messageType,
            payload: payload,
        };
    };
    

    _public.packageCustomEvent = function(eventDetails){
        let packageObject = _public.getBasicPackageObject()

        packageObject.eventType = 'customEvent'
        packageObject.eventDetails = eventDetails
        _public.sendObject(packageObject)
    }

    /**
     * The Observation that tells the server what the page looked like when transmission started. OdoBot makes the observations of
     * uncharted steps itself, from GET_SCREENSHOT.
     * @param userLocation the url in the address bar.
     * @param screenshot a base64 encoded PNG of the visible part of the page.
     */
    _public.packageObservation = function(userLocation, screenshot){
        let packageObject = _public.getBasicPackageObject()

        packageObject.eventType = 'customEvent'
        packageObject.eventDetails = {
            name: 'OBSERVATION',
            trigger: 'START_TRANSMISSION',
            userLocation: userLocation,
            screenshot: screenshot
        }

        return packageObject
    }

    _public.getBasicPackageObject = function(){
        let currentTimestamp = new Date();
        let sessionStartTimestamp = _sessionStartTimestamp
        let libraryStartTimestamp = _libraryStartTimestamp
        
        return {
            eventType: null,
            eventDetails: {},
            sessionID: _sessionID,
            timestamps: {
                eventTimestamp: currentTimestamp,
                sinceSessionStartMillis: currentTimestamp - sessionStartTimestamp,
                sinceLogUILoadMillis: currentTimestamp - libraryStartTimestamp,
            }
            //applicationSpecificData: Config.applicationSpecificData.get(), TODO - consider supporting this feature in the future.
        }
    }

    _public.handleStateChange = function(changes){

        if('shouldRecord' in changes && changes['shouldRecord'].newValue){
            _public.init()
        
        }

        if('shouldTransmit' in changes && changes['shouldTransmit'].newValue){
            _transmit = true
        }

        
        if('shouldTransmit' in changes && !changes['shouldTransmit'].newValue){
            _transmit = false
        }

    }

    OdoBotSocket.on('event', eventChannel.onMessage)

    return _public;
})();


browser.storage.local.onChanged.addListener(GuidanceConnector.handleStateChange)

