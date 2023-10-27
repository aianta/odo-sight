console.log('controls.js says hi')

//Set up persistent communication with background.js
let conn = new PortConnection(CONTROLS_TO_BACKGROUND_PORT_NAME, 'controls.js')

conn.on('NETWORK_EVENT_LOGGED', function(data){
    setStatus('network-events-status', 'green')
    return Promise.resolve({msg:'ack'})
})

$('#start-btn').click(function(event){
    setStatus('logui-status', 'orange')
    conn.send({
        type: 'START_LOGUI'
    },
    function(response){
        $('#session_id').text(response.sessionId)
        setStatus('logui-status', 'green')
    },
    function(error){
        if(error.err_msg.includes('already')){
            setStatus('logui-status', 'green')
        }else{
            setStatus('logui-status', 'red')
            showError(error.err_msg)
        }
    })
})

$('#stop-btn').click(function(event){
    setStatus('logui-status',  'orange')
    conn.send({
        type:'STOP_LOGUI'
    },
    function(response){
        setStatus('logui-status', 'black' )
        $('#session_id').text('-')
    },
    function(error){
        if(error.err_msg.includes('already')){
            setStatus('logui-status', 'black')
        }else{
            setStatus('logui-status', 'red')
            showError(error.err_msg)
        }
    }
    )
})


$('#send_flight_token').click(function(event){
    setStatus('logui-status','orange')
    conn.send({
        type: 'SET_FLIGHT_TOKEN'
    }, function(response){
        console.log('background.js reports token set.')
        $('#session_id').text(response.sessionId)
        setStatus('logui-status', 'green')
    },
    (error)=>{
        setStatus('logui-status', 'red')
        showError(error.err_msg)
    })
})

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
            setStatus('logui-status', 'orange')
            conn.send({
                type:'SET_FLIGHT_TOKEN'
            }, (response)=>{
                setStatus('logui-status', 'green')
                $('#session_id').text(response.sessionId);
            }, (error)=>{
                setStatus('logui-status', 'red')
                showError(error.err_msg)
            }
            )
        })
    })
})

//TODO: someday it may be prudent to store JWT tokens in IndexedDb...
globalThis.getLocalJWT = getLocalJWT




setStatus('logui-status', 'green')
//Handlers

function handleJWTError(err){
    console.log('got here')
    if(err.err_msg === 'ERR_NETWORK'){ //This can happen if the LogUI server is using a self-signed certificate. 
        //If it is a self signed cert problem, display a link leading to an https page for the logUI server,
        //and prompt the user to click it and accept the cert. 
        const selfSignedLinkTarget = `${_LOG_UI_PROTOCOL}://${_LOG_UI_SERVER_HOST}`
        
        //Hide the main frame
        $('#main-frame').addClass('hidden').removeClass('visible')

        //Generate the https link
        $('#self-signed-link')
            .attr('href', selfSignedLinkTarget)
            .attr('target', '_blank')
            .text(selfSignedLinkTarget)
        
        //Display the error message
        $('#self-signed-ssl-msg-box')
            .removeClass('hidden')
            .addClass('visible')

        //Set a time out to hide the error message and display the main frame
        setTimeout(()=>{
            //Display the main frame again. 
            $('#main-frame').addClass('visible').removeClass('hidden')
            
            $('#self-signed-ssl-msg-box')
                .removeClass('visible')
                .addClass('hidden')
            
            
        }, 20000) //20 seconds.

    }
}

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
            }, JWTTokenHandler,
                handleJWTError
            )
        }
    )
}

document.addEventListener('DOMContentLoaded', start);




