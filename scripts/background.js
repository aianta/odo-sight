/**
 * @author Alexandru Ianta
 * 
 * 
 * background.js facilitates communication between different 'scopes' or zones 
 * of the extension. 
 * 
 * Currently the following interactions flow through background.js:
 *
 * 
 * 1. [controls.html]<->background.js<->[LogUI Server]: Many instances of this flow
 * exist. It is used to communicate with the LogUI server and facilitate quality of 
 * life functionality. 
 * 
 * 2. [Content Scripts]<->background.js<->[controls.html]: Used to communicate flight auth tokens and 
 * relay commands from controls.html
 * 
 * 3. [networkRequestLogger]->background.js->[main.js]->[handlerMagic.js]: Used to log
 * network events.
 * 
 * All flows are facilitated by 2-way persistant connections through the 
 * communications API provided by utils.js.
 * 
 */


console.log("backround.js says hi, axios?")

//Setup communication with controls.html & content scripts
let controlsPort;
let contentScriptsPort;
// let devtoolsPort;

function connected(p){
    console.log('connected port:', p)
    switch(p.name){
        case CONTROLS_TO_BACKGROUND_PORT_NAME:
            controlsPort = p;
            setupPortHandler(controlsPort, handleControlRequest)
            break;
        case CONTENT_SCRIPTS_TO_BACKGROUND_PORT_NAME:
            contentScriptsPort = p;
            setupPortHandler(contentScriptsPort, handleContentScriptRequest)
            break;
        // case DEVTOOLS_TO_BACKGROUND_PORT_NAME:
        //     devtoolsPort = p;
        //     setupPortHandler(devtoolsPort, handleDevtoolsRequest)
        //     break;

    }
}

browser.runtime.onConnect.addListener(connected);


/**
 * Communication layer logic: 
 * Saves message _id's and invokes the given logic handler.
 * Logic handler is expected to return a promise. 
 * 
 * If the logic handler's promise completes, injects the original message's _id
 * into the response and sends it back on the port it was recieved on. 
 * 
 * If the logic handler's promise fails, creates an error object which also includes
 * the original message's _id and sends the error object back on the port it was recieved on.
 * 
 */
function setupPortHandler(port, logicHandler){

    console.log('Logic Handler:')
    console.log(logicHandler)


    port.onMessage.addListener((data)=>{
        console.debug(`[background.js][PORT:${port.name}][REQUEST:${data._id}][${data.type}] ${JSON.stringify(data, null, 4)}`)
        let _id = data._id //Extract message id
       /**
         * Responses to requests won't have types, and because of that, we shouldn't
         * pass them down to our logic handler which infers what to do based on
         * the type of request. Instead we should send that message along to whomever
         * we didn't recieve it from. So if a message without a type comes from main.js/content scripts
         * we send it to controls. If a message without a type comes from controls, we send it
         * to content scripts.
         * 
         * TODO: if there ever are responses that have to go back to devtools, may have to make some changes here.
         */
        if(data.type === undefined){
            switch(port.name){
                case CONTENT_SCRIPTS_TO_BACKGROUND_PORT_NAME:
                    controlsPort.postMessage(data)
                    break;
                case CONTROLS_TO_BACKGROUND_PORT_NAME:
                    contentScriptsPort.postMessage(data)
                    break;
            }
            return
        }
        //Otherwise if a message has a type, proceed with invoking the logic handler.
        logicHandler(data).then(function(result){
            //Handle successfully logic handler result.
            result._id = _id
            console.debug(`[background.js][PORT:${port.name}][RESPONSE:${result._id}] ${JSON.stringify(result, null, 4)}`)
            port.postMessage(result)
        }).catch((err)=>{
            //Handle logic handler error/failure
            error_object = {
                _id:_id,
                err_msg: typeof err === 'object'?err.message:err
            }
            console.debug(`[background.js][PORT:${port.name}][RESPONSE:${error_object._id}] ${JSON.stringify(error_object, null, 4)}`)
            port.postMessage(error_object)
        })
    })
}






// /**
//  * Handles requests originating from the devtools scripts
//  * @param {Object} data 
//  */
// function handleDevtoolsRequest(data){
//     switch(data.type){
//         case "LOG_NETWORK_EVENT":
//             contentScriptsPort.postMessage(data)
//             break;
//     }
// }


/**
 * Handles request originating from the content scripts
 * @param {Object} data 
 * @returns 
 */
function handleContentScriptRequest(data){
    switch(data.type){
        case "START_DISPATCHER":
            LogUIDispatcher.init( data.endpoint, data.authToken, contentScriptsPort)
            break;
        case "LOGUI_EVENT":
            //TODO: invoke LogUI Websocket dispatcher
            LogUIDispatcher.sendObject(data.payload)
            break;
        case "GET_FLIGHT_TOKEN":
            return getFlightToken()
        case "NETWORK_EVENT_LOGGED":
            controlsPort.postMessage(data)
            break;
        case "SET_FLIGHT_TOKEN":
            //These requests are actually just responses to controls.html, send them along
            controlsPort.postMessage(data)
            break;
    }
}

/**
 * Handles requests originating from the controls scripts.
 * @param {Object} data 
 * @returns 
 */
function handleControlRequest(data){

    switch(data.type){
        case "GET_JWT_TOKEN": 
            //Fetch the JWT
            return getJWT(data.username, data.password)
                .then(function(response){
                    return Promise.resolve(response.data)  
                },function(err){
                    return Promise.reject(err.code)
                })
        case "GET_APP_LIST":
            return getLogUIAppList().then(function(response){
                return Promise.resolve(response.data)
            })
        case "GET_FLIGHT_LIST":
            return getFlightList(data.appId).then(function(response){
                return Promise.resolve(response.data)
            })
        case "CREATE_FLIGHT":
            return createFlight(data.appId, data.flightName, data.flightDomain).then(function(response){
                return Promise.resolve(response.data)
            })
        case "SCRAPE_MONGO":
            return scrapeMongo()
        case 'STOP_LOGUI':
            contentScriptsPort.postMessage(data)
            break;
        case 'START_LOGUI':
            contentScriptsPort.postMessage(data)
            break;
        case "SET_FLIGHT_TOKEN": 
            getFlightToken().then((flight_token)=>{
                payload = {
                    _id: data._id,
                    type:'SET_FLIGHT_TOKEN',
                    ...flight_token
                }
                contentScriptsPort.postMessage(payload)
            })
            break;
            
    }

}

//AXIOS requests

function scrapeMongo(){
    return getSelectedFlight()
    .catch(function(err){
        return Promise.reject("No selected flight, cannot scrape!")
    })
    .then(function(flight){
        return axios.post(`http://${_ODO_BOT_SIGHT_SERVER_HOST}${_ODO_BOT_SIGHT_SCRAPE_MONGO_PATH}`, {
            flightName: flight.name,
            flightId: flight.id
        }).then(function(response){
            return Promise.resolve({
                statusCode: response.status
            })
        })
    })
}


/**
 * Fetches a JWT from the LogUI server.
 * @param {String} username LogUI server username
 * @param {String} password LogUI server password
 */
function getJWT(username, password){
    return new Promise((resolve, reject)=>{
        console.log(`${_LOG_UI_PROTOCOL}://${_LOG_UI_SERVER_HOST}${_LOG_UI_JWT_PATH}`)

        axios.post(`${_LOG_UI_PROTOCOL}://${_LOG_UI_SERVER_HOST}${_LOG_UI_JWT_PATH}`, {
            username: username,
            password: password
        }).then(function(response){
            resolve(response)
        }).catch(function(err){
            console.error( "Error fetching JWT token: ",err)
            reject(err)
        })
    })

}

function getLogUIAppList(){
    return axios.get(`${_LOG_UI_PROTOCOL}://${_LOG_UI_SERVER_HOST}${_LOG_UI_APP_LIST_PATH}`)
        .then(function(response){
            return Promise.resolve(response)
        })
        .catch(function(err){
            console.error("Error fetching application list: ", err)
            return Promise.reject(err)
        })
}

function getFlightList(appId){
    return axios.get(`${_LOG_UI_PROTOCOL}://${_LOG_UI_SERVER_HOST}${_LOG_UI_FLIGHT_LIST_PATH}${appId}/`)
        .then(function(response){
            return Promise.resolve(response)
        }).catch(function(err){
            console.error("Error fetching flight list: ", err)
            return Promise.reject(err)
        })
}

function createFlight(appId, flightName, flightDomain){
    return axios.post(`${_LOG_UI_PROTOCOL}://${_LOG_UI_SERVER_HOST}${_LOG_UI_FLIGHT_CREATE(appId)}`,{
        flightName: flightName,
        fqdn: flightDomain
    }).then(function(response){
        return Promise.resolve(response)
    }).catch(function(err){
        console.error("Error creating flight: ", err)
        return Promise.reject(err)
    })
}

function getFlightToken(){
    return getSelectedFlight()
    .catch(err=>Promise.reject("No selected flight, cannot fetch token!"))
    .then(function(flight){
        return axios.get(`${_LOG_UI_PROTOCOL}://${_LOG_UI_SERVER_HOST}${_LOG_UI_FLIGHT_TOKEN_PATH(flight.id)}`)
        .then(function(response){
            return Promise.resolve(response.data)
        }).catch(function(error){
            console.error("Error getting flight token: ", err)
            return Promise.reject(err)
        })
    })
}

//Inject auth token for LogUI Server requests
axios.interceptors.request.use(function(request){
    //If this is a call to the LogUI server other than the one used to retrieve the JWT token itself. 
    if(request.url.includes(_LOG_UI_SERVER_HOST) &&
        request.url !== `${_LOG_UI_PROTOCOL}://${_LOG_UI_SERVER_HOST}${_LOG_UI_JWT_PATH}`){

        console.log("Injecting Auth token for " + request.url)

        //Embed the jwt token in the request header.
        return getLocalJWT().then(function(jwt){
            request.headers.Authorization = `jwt ${jwt}`
            return Promise.resolve(request)
        })
        .catch(function(err){
            console.error("Tried to make authorized call to LogUI server but didn't have JWT token available!", err)
        });
    }

    return request
})

function logNetworkRequest(record){

    var _fields = [
        "timeStamp", //The sky will fall if this is not included.
        "requestId",
        "method", 
        "requestBody",
        "url",
        "documentUrl",
        "type"
    ]
    
    //TODO: should get the host programatically.
    let target_host = "localhost:8088"

    //Only capture xmlhttprequests going to the target host
    if(record.type === 'xmlhttprequest' && record.url.includes(target_host)){
        //Intercept the response https://github.com/mdn/webextensions-examples/blob/main/http-response/background.js
        let filter = browser.webRequest.filterResponseData(record.requestId)
        let decoder = new TextDecoder("utf-8")
        let encoder = new TextEncoder()
        let eventDetails = {
            name: "NETWORK_EVENT"
        }


        filter.ondata = event => {


            console.log(record)

            for (const [key, value] of Object.entries(record)){
                if(_fields.includes(key)){
                    
                    if(typeof value === 'object'){
                        eventDetails[key] = JSON.stringify(value)
                    }else{
                        eventDetails[key] = value
                    }

                }
            }
                

            

            let str = decoder.decode(event.data, {stream:true})

            try{
                let jsonData = JSON.parse(str)
                eventDetails['responseBody'] = str
            }catch(error){
                //Parsing error, the response data wasn't json, so we don't care about it.
            }finally{
                filter.write(event.data)
                filter.disconnect()
            }
            
            

        
            console.log(`eventDetails: ${JSON.stringify(eventDetails)}`)

            // postWithRetry(contentScriptsPort, {
            //     type: "LOG_NETWORK_EVENT",
            //     eventDetails: eventDetails
            // })

            // contentScriptsPort.postMessage({
            //         type: "LOG_NETWORK_EVENT",
            //         eventDetails: eventDetails
            //     })
        }
    }

   





}


browser.webRequest.onBeforeRequest.addListener(logNetworkRequest ,{
    urls: ["<all_urls>"]
},['blocking','requestBody'])

