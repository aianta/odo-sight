/**
 * @author Alexandru Ianta
 * 
 * 
 * background.js facilitates communication between different 'scopes' or zones 
 * of the extension. 
 * 
 * Currently the following interactions flow through background.js:
 * 
 * 1. [Content Scripts]->background.js: This flow is invoked by content scripts and 
 * reports the TAB id of the content script to background.js. This tab id is used 
 * in the [devtools.html]->background.js->[Content Scripts] flow to direct messages
 * to the correct tab.
 * 
 * 2. [devtools.html]->background.js->[Content Scripts]: This flow is invoked by 
 * the devtools scripts which monitor network request traffic. They pass along 
 * the NETWORK_EVENT details which background.js sends to the [Content Scripts] 
 * where the LogUI client exists so that the network event may be logged. 
 * 
 * 3. [controls.html]<->background.js<->[LogUI Server]: Many instances of this flow
 * exist. It is used to communicate with the LogUI server and facilitate quality of 
 * life functionality. 
 * 
 * 4. [Content Scripts]<->background.js<->[controls.html]: Used to communicate flight auth tokens and 
 * relay commands from controls.html
 * 
 * Unlike flows 1. & 2. flow 3 & 4. is facilitated by ongoing connections between 
 * sender and recipient. This is managed through the browser.runtime.onConnect listener
 * 
 */


console.log("backround.js says hi, axios?")

//Setup communication with controls.html & content scripts
let controlsPort;
let contentScriptsPort;

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
    }
}


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
    port.onMessage.addListener((data)=>{
        console.debug(`[PORT:${port.name}][REQUEST:${data._id}][${data.type}] ${JSON.stringify(data, null, 4)}`)
        let _id = data._id //Extract message id
        logicHandler(data).then(function(result){
            //Handle successfully logic handler result.
            result._id = _id
            console.debug(`[PORT:${port.name}][RESPONSE:${result._id}] ${JSON.stringify(result, null, 4)}`)
            port.postMessage(result)
        }).catch(err=>{
            //Handle logic handler error/failure
            error_object = {
                _id:_id,
                err_msg: err
            }
            console.debug(`[PORT:${port.name}][RESPONSE:${error_object._id}] ${JSON.stringify(error_object, null, 4)}`)
            port.postMessage(error_object)
        })
    })
}



browser.runtime.onConnect.addListener(connected);

browser.runtime.onMessage.addListener(
    (data, sender, sendResponse)=>{
        console.log("woah got message from:", sender, sendResponse)
    
        if(sender.url.includes("devtools.html")){

            handleNetworkEventFromDevTools(data, sender, sendResponse)

        }else{
            
            handleContentScriptTabRegistration(data, sender, sendResponse)
        }

    }
)

/**
 * Implements flow 1.
 */
function handleContentScriptTabRegistration(data, sender, sendResponse){
    console.log('saving tabId of content script with LogUI instance.')
            
    //This is a message from the content script
    browser.storage.local.set({tab_destination: sender.tab.id})
}


/**
 * Implements flow 2.
 */
function handleNetworkEventFromDevTools(data, sender, sendResponse){
    console.log("Passing data from devtools to content script!")
    //Get the tab id to send to
    browser.storage.local.get(['tab_destination'], (result)=>{
        console.log("browser storage result", result)
        if(!result || result === undefined || result === {}){
            console.log("tab_destination not yet set!")
            return 
        }
        let tab_destination = result.tab_destination

        //Send message to content script
        browser.tabs.sendMessage(tab_destination, data)
    })
}

function handleContentScriptRequest(data){
    switch(data.type){
        case "GET_FLIGHT_TOKEN":
            return getFlightToken()
    }
}

function handleControlRequest(data, sender, sendResponse){

    switch(data.type){
        case "GET_JWT_TOKEN": 
            //Fetch the JWT
            return getJWT(data.username, data.password)
                .then(function(response){
                    return Promise.resolve(response.data)  
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
        console.log(`http://${_LOG_UI_SERVER_HOST}${_LOG_UI_JWT_PATH}`)
        axios.post(`http://${_LOG_UI_SERVER_HOST}${_LOG_UI_JWT_PATH}`, {
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
    return axios.get(`http://${_LOG_UI_SERVER_HOST}${_LOG_UI_APP_LIST_PATH}`)
        .then(function(response){
            return Promise.resolve(response)
        })
        .catch(function(err){
            console.error("Error fetching application list: ", err)
            return Promise.reject(err)
        })
}

function getFlightList(appId){
    return axios.get(`http://${_LOG_UI_SERVER_HOST}${_LOG_UI_FLIGHT_LIST_PATH}${appId}/`)
        .then(function(response){
            return Promise.resolve(response)
        }).catch(function(err){
            console.error("Error fetching flight list: ", err)
            return Promise.reject(err)
        })
}

function createFlight(appId, flightName, flightDomain){
    return axios.post(`http://${_LOG_UI_SERVER_HOST}${_LOG_UI_FLIGHT_CREATE(appId)}`,{
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
        return axios.get(`http://${_LOG_UI_FLIGHT_TOKEN_PATH(flight.id)}`)
        .then(function(response){
            return Promise.resolve(response)
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
        request.url !== `http://${_LOG_UI_SERVER_HOST}${_LOG_UI_JWT_PATH}`){

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