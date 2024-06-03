/**
 * 
 * @author Alexandru Ianta
 * @date November 1 2023
 * 
 * IIFE function that implements REST communication with LogUI and Odo Bot servers via axios for use
 * throughout the extension. 
 */

var services = (function(){
    var _public = {}

    /**
     * Make a call to the guidance service to ensure successfuly communication over HTTPS. 
     * If an error occurs then the user likely has to manually accept a self-signed certificate from the server.
     */
    _public.guidanceConnectionCheck = function(){
        console.log('checking guidance service connection')
        return stateManager.guidanceHost().then(function(guidanceHost){
            const GUIDANCE_HOST_LINK = `https://${guidanceHost}`
            return axios.get(GUIDANCE_HOST_LINK)
                .then(function(response){
                    return Promise.resolve()
                })
                .catch(function(error){
                    error.hostLink = GUIDANCE_HOST_LINK //Attach the guidance host link to the error for ease of handling
                    return Promise.reject(error)
                })
        })        
    }

    _public.scrapeMongo = function (flight, index){
        return stateManager.odoSightSupportHost().then(function(odoSightSupportHost){
            return axios.post(`http://${odoSightSupportHost}${_ODO_BOT_SIGHT_SCRAPE_MONGO_PATH}`, {
                esIndex: index,
                flightName: flight.name,
                flightId: flight.id
            }).then(function(response){
                return Promise.resolve({
                    statusCode: response.status
                })
            })
        })
    }
    

    _public.getLogUIAppList = function (){
        return axios.get(`${_LOG_UI_PROTOCOL}://${_LOG_UI_SERVER_HOST}${_LOG_UI_APP_LIST_PATH}`)
            .then(function(response){
                return Promise.resolve(response.data)
            })
            .catch(function(err){
                console.error("Error fetching application list: ", err)
                return Promise.reject(err)
            })
    }
    
    _public.getFlightList = function(appId){
        return axios.get(`${_LOG_UI_PROTOCOL}://${_LOG_UI_SERVER_HOST}${_LOG_UI_FLIGHT_LIST_PATH}${appId}/`)
            .then(function(response){
                return Promise.resolve(response.data)
            }).catch(function(err){
                console.error("Error fetching flight list: ", err)
                return Promise.reject(err)
            })
    }
    
    _public.createFlight = function (appId, flightName, flightDomain){
        return axios.post(`${_LOG_UI_PROTOCOL}://${_LOG_UI_SERVER_HOST}${_LOG_UI_FLIGHT_CREATE(appId)}`,{
            flightName: flightName,
            fqdn: flightDomain
        }).then(function(response){
            return Promise.resolve(response.data)
        }).catch(function(err){
            console.error("Error creating flight: ", err)
            return Promise.reject(err)
        })
    }
    
    _public.getFlightToken = function(){
        return stateManager.selectedFlight()
        .catch(_=>Promise.reject("No selected flight, cannot fetch token!"))
        .then(function(flight){
            return axios.get(`${_LOG_UI_PROTOCOL}://${_LOG_UI_SERVER_HOST}${_LOG_UI_FLIGHT_TOKEN_PATH(flight.id)}`)
            .then(function(response){
                // stateManager.flightAuthToken(response.data.flightAuthorisationToken)
                return Promise.resolve(response.data)
            }).catch(function(error){
                console.error("Error getting flight token: ", err)
                return Promise.reject(err)
            })
        })
    }
    
    /**
     * Fetches a JWT from the LogUI server.
     * @param {String} username LogUI server username
     * @param {String} password LogUI server password
     */
    _public.getJWT = function(username, password){
        return new Promise((resolve, reject)=>{
            console.log(`${_LOG_UI_PROTOCOL}://${_LOG_UI_SERVER_HOST}${_LOG_UI_JWT_PATH}`)
    
            axios.post(`${_LOG_UI_PROTOCOL}://${_LOG_UI_SERVER_HOST}${_LOG_UI_JWT_PATH}`, {
                username: username,
                password: password
            }).then(function(response){
                stateManager.jwt(response.data.token).then(_=>resolve(response.data.token))
            }).catch(function(err){
                console.error( "Error fetching JWT token: ",err)
                reject(err)
            })
        })
    
    }

    return _public
})()


//Inject auth token for LogUI Server requests
axios.interceptors.request.use(function(request){
    //If this is a call to the LogUI server other than the one used to retrieve the JWT token itself. 
    if(request.url.includes(_LOG_UI_SERVER_HOST) &&
        request.url !== `${_LOG_UI_PROTOCOL}://${_LOG_UI_SERVER_HOST}${_LOG_UI_JWT_PATH}`){

        console.log("Injecting Auth token for " + request.url)

        //Embed the jwt token in the request header.
        return stateManager.jwt().then( //First attempt to get the JWT from the extension state
            function(jwt){
                request.headers.Authorization = `jwt ${jwt}`
                return Promise.resolve(request)
            },
            _=>services.getJWT(_LOG_UI_DEFAULT_USERNAME,_LOG_UI_DEFAULT_PASSWORD).then(function(jwt){ //But if it doesn't exist there, go fetch it from the LogUI server.
                request.headers.Authorization = `jwt ${jwt}`
                return Promise.resolve(request)
            },
            _=>console.error('Failed to retrieve JWT from LogUI server. Are you using a self-signed cert?'))
        )
        .catch(function(err){
            console.error("Tried to make authorized call to LogUI server but didn't have JWT token available!", err)
        });
    }

    return request
})
