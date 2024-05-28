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


var LocalDispatcher = (function() {
    var _public = {};
    var _isActive = false;
    var _cacheSize = 10 // The maximum number of stored events that can be in the cache before flushing.
    var _libraryLoadTimestamp = null;  // The time at which the dispatcher loads -- for measuring the beginning of a session more accurately.
    var _maximumCacheSize = 1000;  // When no connection is present, this is the cache size we shut down LogUI at.
    var _sessionID = null;
    var _sessionStartTimestamp = null;
    var _libraryStartTimestamp = null;
    var _cache = null;


    _public.dispatcherType = 'local';


    _public.init = function() {

        //Reset the local contex
        _initLocalContext();
        _cache = [];

        _isActive = true;
        return true;
    };

    _public.stop = async function() {
        _cache = null;
        _isActive = false;
        _sessionID = null;
        stateManager.clearSessionId()
    };

    _public.isActive = function() {
        return _isActive !== null && _isActive
    };

    _public.sendObject = function(objectToSend) {
        if (_public.isActive()) {
            _cache.push(objectToSend);


            if (_cache.length >= _cacheSize) {
                _flushCache();
            }

            return;
        }

        throw Error('You cannot send a message when LogUI is not active.');
    };

    var _initLocalContext = function(){
        stateManager.localContext([]) //Reset the localContext to an empty array
    }

    var _getMessageObject = function(messageType, payload) {
        return {
            sender: 'logUIClient',
            type: messageType,
            payload: payload,
        };
    };

    var _flushCache = function() {
        
        if (_cache.length >= _maximumCacheSize) {
            console.warn(`[LogUI Websocket Dispatcher] The cache has grown too large, with no connection to clear it. LogUI will now stop; any cached events will be lost.`)
            
            //TODO: send shutdown request to odosight dispatcher. 
            stateManager.eventCacheOverflow(true)
            return;
        }

        stateManager.add('localContext', _cache)
        

        console.log(`[LogUI Websocket Dispatcher] Cache flushed.`)

        _cache = [];
    };
    

    _public.packageCustomEvent = function(eventDetails){
        let packageObject = _public.getBasicPackageObject()

        packageObject.eventType = 'customEvent'
        packageObject.eventDetails = eventDetails
        if(_public._websocket !== null){ //Only send object if we have a websocket connection
            _public.sendObject(packageObject)
        }else{
            console.error("Failed to send: ")
            console.error(JSON.stringify(eventDetails, null, 4))
        }


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
        if('shouldTrace' in changes && changes['shouldTrace'].newValue){
            _public.init()
        
        }
    }

    return _public;
})();


browser.storage.local.onChanged.addListener(LocalDispatcher.handleStateChange)