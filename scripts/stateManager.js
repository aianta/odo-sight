/**
 * @author Alexandru Ianta
 * @date October 31 2023
 * 
 * IIFE function that implements a state API for use throughout the extension. 
 * 
 * There are 4 main states in which the extension may find itself.
 * 
 * 1) IDLE: In this state the extension is not doing anything in the background, this state
 * usually inidicates that the add-on has not yet been configured or is misconfigured. 
 * 
 * 2) RECORDING: In this state the extension records user interactions and saves them to local storage.
 * 
 * 3) TRANSMITTING: In this state the extension transmits user interactions directly to the Odo Bot server.
 * This state should be active during a request for help/guidance, where the user is being directed to some 
 * place in the application, and odo bot needs to receive feedback on the user's progress. 
 * 
 * 4) TRACING: This is a manually controlled recording state, for recording traces that are sent to the LOG UI server.
 * Traces recorded in this fashion are used to construct the application model for Odo Bot. 
 * 
 */

var stateManager = (function(){
    var _public = {};

    _public.init = function(){
        stateValid().then(function(isValid){
            console.log(`isValid ${isValid}`)
            if(!isValid){
                browser.storage.local.clear().then(setupBlankState)
            }
        })
    }



    function setupBlankState(){
        const state = {
            stateVersion: `${_ODO_SIGHT_VALID_STATE_VERISON}`, // version of the stored state data. Incremented when breaking changes are made.
            isIdle: true,
            shouldRecord: false,   //The target passive recording state
            isRecording: false,    //The actual passive recording state
            shouldTransmit: false, //The target real-time transmission state
            isTransmitting: false, //The actual real-time transmission state
            shouldTrace: false,    //The target LogUI state, whether it should be recording or not.
            isTracing: false,      //The actual LogUI state, whether it is recording or not.
            logUIConfig: {},
            jwt: undefined, //Authentication token for communication with LogUI Server
            sessionId: undefined, 
            sessionData: undefined,
            sessionReady: false,
            endpoint: 'ws://localhost:8000/ws/endpoint/',
            targetHost: 'localhost:8088',
            odoSightSupportHost: 'localhost:8079',
            flightAuthToken: undefined, 
            eventCacheOverflow: false,
            pageOrigin: undefined, 
            username: undefined, //LogUI Server username
            password: undefined, //LogUI Server password
            localContext: undefined, //Storage space for the LocalDispatcher
            boundDispatcher: undefined //The dispatcher to use when processing LogUI events. Valid values are: 'local', 'logui', 'realtime'
        }

        return browser.storage.local.set(state).then(afterStateInit, onError);
    }


    _public.boundDispatcher = function(data){
        if(data === undefined){
            return _public.get('boundDispatcher')
        }
        return _public.set('boundDispatcher', data)
    }

    _public.localContext = function(data){
        if(data === undefined){
            return _public.get('localContext')
        }
        return _public.set('localContext', data)
    }

    _public.clearSessionId = function(){
        return _public.set('sessionId', undefined)
    }

    /**
     * Helper functions for setting and retrieving core Odo Sight state variables. 
     */
    _public.sessionData = function(data){
        if(data === undefined){
            return _public.get('sessionData')
        }

        return _public.set('sessionData', data)
    }

    _public.pageOrigin = function(origin){
        if(origin === undefined){
            return _public.get('pageOrigin')
        }

        return _public.set('pageOrigin', origin)
    }

    _public.selectedFlight = function(flight){
        if(flight === undefined){
            return _public.get('selectedFlight')
        }
        return _public.set('selectedFlight', flight)
    }

    _public.username = function(username){
        console.log('updating username to ', username)
        if(username === undefined){
            return _public.get('username')
        }
        return _public.set('username', username)
    }

    _public.password = function(password){
        if(password === undefined){
            return _public.get('password')
        }

        return _public.set('password', password)
    }

    _public.selectedApp = function(app){
        if(app === undefined){
            return _public.get('selectedApp')
        }

        return _public.set('selectedApp', app)
    }

    _public.endpoint = function(endpoint){
        if(endpoint === undefined){
            return _public.get('endpoint')
        }
        return _public.set('endpoint', endpoint)
    }

    _public.targetHost = function(targetHost){
        if(targetHost === undefined){
            return _public.get('targetHost')
        }
        return _public.set('targetHost', targetHost)
    }

    _public.odoSightSupportHost = function(odoSightSupportHost){
        if(odoSightSupportHost === undefined){
            return _public.get('odoSightSupportHost')
        }
        return _public.set('odoSightSupportHost', odoSightSupportHost)
    }

    _public.jwt = function(jwt){
        if(jwt === undefined){
            return _public.get('jwt')
        }
        return _public.set('jwt', jwt)
    }


    /**
     * @param sessionId If this parameter is set, updates the sessionId to this value.
     * @returns The logUI sessionID
     */
    _public.sessionId = function(sessionId){
        if (sessionId === undefined){
            return _public.get('sessionId')
        }
        return _public.set('sessionId', sessionId)
    }

    _public.eventCacheOverflow = function(flag){
        if(flag === undefined){
            return _public.get('eventCacheOverflow')
        }

        return _public.set('eventCacheOverflow', flag)
    }

    _public.sessionReady = function(flag){
        if(flag === undefined){
            return _public.get('sessionReady')
        }

        return _public.set('sessionReady', flag)
    }

    _public.shouldTransmit = function(flag){
        if(flag === undefined){
            return _public.get('shouldTransmit')
        }
        return _public.set('shouldTransmit', flag)
    }

    _public.shouldTrace = function(flag){
        if(flag === undefined){
            return _public.get('shouldTrace')
        }
        return _public.set('shouldTrace', flag)
    }    


    _public.shouldRecord = function(flag){
        if(flag === undefined){
            return _public.get('shouldRecord')
        }
        return _public.set('shouldRecord', flag)
    }

    _public.logUIConfig = async function(config){
        if(config === undefined){
            return await _public.get('logUIConfig')
        }
        await _public.set('logUIConfig', config)
    }


    _public.flightAuthToken = function(flightAuthToken){
        if(flightAuthToken === undefined){
            return _public.get('flightAuthToken')
        }
        return _public.set('flightAuthToken', flightAuthToken)
    }


    /**
     * @param {*} key to check
     * @returns true, if key exists in the stored state.
     */
    _public.exists = function (key){
        return browser.storage.local.get(key).then((data)=>key in data)
    }

    /**
     * Sets the given key to the given value 
     * @param {String} key to set
     * @param {*} value to set
     */
    _public.set = function (key, value){
        const data = {}
        data[key] = value
        return browser.storage.local.set(data)
    }

    /**
     * Adds an element or array to an array stored in the odo sight state.
     * @param {*} key to which the value should be added
     * @param {*} value to be added to the array under the specified key
     * @returns 
     */
    _public.add = function(key, value){
        if(value === undefined){
            return Promise.reject("Cannot add because no value has been passed to add.")
        }


        return browser.storage.local.get(key)
            .then((data)=>{
                //Key must exist.
                if(!(key in data)){
                    return Promise.reject(`${key} does not exist in the stored odo sight state.`)
                }
                
                //Key-value must be array
                if(!Array.isArray(data[key])){
                    return Promise.reject(`Cannot add item to ${key} in odo sight state, because ${key} value is not an array!`)
                }

                return _public.set(key, data[key].concat(value))
            
            }

        )
    }

    /**
     * @param {String} key to whose value to retrieve
     * @returns the value of the key if it exists. Undefined if it does not.
     */
    _public.get = function(key){
        return browser.storage.local.get(key)
            .then((data)=>key in data ? 
                data[key]:
                Promise.reject(`${key} does not exist in the stored odo sight state.`)
                )
    }


    /**
     * 
     * @returns true if the stored state version matches the expected valid state version in constants.js
     */
    function stateValid(){
        return _public.get('stateVersion').then(
            (version)=> version === _ODO_SIGHT_VALID_STATE_VERISON,
            _=>false //If no stateVersion key exists the state is not valid.
        )
    }


    function afterStateInit(){
        console.log('Odo sight state initialized.')
    }
    
    function onError(error){
        console.log(error)
    }
    


    return _public;
})();

