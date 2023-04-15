console.log('controls.js says hi')

//Set up persistent communication with background.js
let conn = new BackgroundConnection(CONTROLS_TO_BACKGROUND_PORT_NAME)

/**
 * Handler to invoke mongo scrape procedure
 */
$('#scrape_mongo_btn').click(function(event){
    conn.send({
        type:'SCRAPE_MONGO'
    }, 
    function(response){
        $('#scrape-ok').addClass('visible')
            setTimeout(()=>{
                $('#scrape-ok').removeClass('visible').addClass('hidden')
            }, 5000)
    },
    function(response){
        showError(response.err_msg)

        $('#scrape-error').addClass('visible')
        setTimeout(()=>{
            $('#scrape-error').removeClass('visible').addClass('hidden')
        }, 5000)
    }
    )
})

/**
 * Setup logic for creating new flights
 */
$('#new-flight-btn').click(function(event){
    console.log('new flight button handler got: ', event)
    let btn = event.delegateTarget
    let appId = btn.getAttribute('app-id')
    let flightName = $('#new-flight-name').val()
    conn.send({
        type: 'CREATE_FLIGHT',
        appId: appId,
        flightName: flightName,
        flightDomain: _DEFAULT_FLIGHT_DOMAIN
    }, function(response){
        console.log('new-flight-button handler got 2: ', response)

        conn.send({
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




setStatus('logui-status', 'green')
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
            conn.send({
                type: 'GET_FLIGHT_LIST',
                appId: app.id
            }, function(response){
                startFlightSelect(app, response)
            })
        })
    })
}


console.log("LOCAL JWT", getLocalJWT)

function start(){
    /**
     * On start up check to see if we have a logui_jwt token saved in local storage.
     */

    globalThis.getLocalJWT().then(
        function(jwt){
            //If we do, proceed to fetch our application list.
            conn.send({
                type: "GET_APP_LIST"
            }, AppListHandler)

        },
        function(noJwt){
            //If we don't have a JWT token, go fetch it.
            conn.send({
                type:"GET_JWT_TOKEN",
                username: _LOG_UI_DEFAULT_USERNAME,
                password: _LOG_UI_DEFAULT_PASSWORD
            }, JWTTokenHandler)
        }
    )
}

document.addEventListener('DOMContentLoaded', start);




