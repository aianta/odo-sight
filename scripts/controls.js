console.log('controls.js says hi')

$('#new-flight-btn').click(function(event){
    console.log('new flight button handler got: ', event)
    let btn = event.delegateTarget
    let appId = btn.getAttribute('app-id')
    let flightName = $('#new-flight-name').val()
    sendToBackgroundJs({
        type: 'CREATE_FLIGHT',
        appId: appId,
        flightName: flightName,
        flightDomain: _DEFAULT_FLIGHT_DOMAIN
    }, function(response){
        console.log('new-flight-button handler got 2: ', response)

        sendToBackgroundJs({
            type: 'GET_FLIGHT_LIST',
            appId: appId
        }, function(flights){
            console.log('new-flight-button handler got 3: ', flights)
            let createdFlight = flights.find(flight=>flight.name === flightName)
            console.log('created flight', createdFlight)
            browser.storage.local.set({selected_flight: createdFlight})
            backToMainFrame()
        })
    })
})

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

    response.forEach( function (app,index){
        let app_entry = $(`
        <div index=${index} id='${app.id}' class='app-entry'>
        <span class="app-name">${app.name}</span>
        
        <span id='${app.id}-select'></span>
        </div>`)

        $('#app-list').append(app_entry)
        $(`#${app.id}-select`).button({
            icon: 'fa-solid fa-arrow-right'
        }).click( function(event){
            sendToBackgroundJs({
                type: 'GET_FLIGHT_LIST',
                appId: app.id
            }, function(response){
                startFlightSelect(app, response)
            })
        })
    })
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




