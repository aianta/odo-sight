/**
 * @author Alexandru Ianta
 * @date October 31 2023
 * 
 * IIFE function that implements a state API for use throughout the extension. 
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
            shouldRecord: false, //The target LogUI state, whether it should be recording or not.
            isRecording: false, //The actual LogUI state, whether it is recording or not.
            logUIConfig: undefined,
            jwt: undefined,
            sessionId: undefined,
            flightAuthToken: undefined
        }

        return browser.storage.local.set(state).then(afterStateInit, onError);
    }

    _public.clearSessionId = function(){
        return _public.set('sessionId', undefined)
    }

    /**
     * Helper functions for setting and retrieving core Odo Sight state variables. 
     */
    _public.selectedFlight = function(flight){
        if(flight === undefined){
            return _public.get('selectedFlight')
        }
        return _public.set('selectedFlight', flight)
    }

    _public.selectedApp = function(app){
        if(app === undefined){
            return _public.get('selectedApp')
        }

        return _public.set('selectedApp', app)
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

