console.log('controls.js says hi')

//TODO: someday it may be prudent to store JWT tokens in IndexedDb...
globalThis.getLocalJWT = getLocalJWT

//Set up persistent communication with background.js
let port = browser.runtime.connect({name:"port-from-controls"})
let messageMap = new Map()

setStatus('logui-status', 'green')
/**
 * Wrapper function that adds a uuid to messages sent to background.js 
 * @param {*} data 
 */
function sendToBackgroundJs(data, onResponse){
    console.log("creating UUID", crypto.randomUUID())
    data._id = crypto.randomUUID()
    console.log("sending: ",data)
    port.postMessage(data)
    messageMap.set(data._id, onResponse)
}

function handleBackgroundJsMsg(msg){
    console.debug("controls.html got message from background.js", msg)
    //Call the handler for this msg id
    messageMap.get(msg._id)(msg)
    //Clear the message from the message map
    messageMap.delete(msg._id) 
}
port.onMessage.addListener(handleBackgroundJsMsg)

//Handlers

function JWTTokenHandler(response){
    console.log("Got response from LogUI server:", response)        
    browser.storage.local.set({logui_jwt: response.token})
}

function AppListHandler(response){
    console.log("Got application list: ", response)

}

function genericErrorHandler(err){
    console.error("An error has occurred! ", err)
}

console.log("LOCAL JWT", getLocalJWT)

function start(){
    /**
     * On start up check to see if we have a logui_jwt token saved in local storage.
     */

    globalThis.getLocalJWT().then(
        function(jwt){
            //If we do, proceed to fetch our application list.
            sendToBackgroundJs({
                type: "GET_APP_LIST"
            }, AppListHandler)

        },
        function(noJwt){
            //If we don't have a JWT token, go fetch it.
            sendToBackgroundJs({
                type:"GET_JWT_TOKEN",
                username: _LOG_UI_DEFAULT_USERNAME,
                password: _LOG_UI_DEFAULT_PASSWORD
            }, JWTTokenHandler)
        }
    )
}

document.addEventListener('DOMContentLoaded', start);




