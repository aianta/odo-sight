

/**
 * Handler to invoke mongo scrape procedure
 */

function isEmpty(value) {
    return (value == null || (typeof value === "string" && value.trim().length === 0));
}

$('#scrape_mongo_btn').click(function(event){
    const esIndex = $('#scrape-index').val()
    if(isEmpty(esIndex)){
        showError("Cannot scrape without target ES index!")
    }else{
        stateManager.selectedFlight()
        .then((flight)=>services.scrapeMongo(flight, esIndex)
        .then(_=>{
            $('#scrape-ok').addClass('visible')
            setTimeout(()=>{
                $('#scrape-ok').removeClass('visible').addClass('hidden')
            }, 5000)
        }, (err)=>{
            showError(err)

            $('#scrape-error').addClass('visible')
            setTimeout(()=>{
                $('#scrape-error').removeClass('visible').addClass('hidden')
            }, 5000)
        }))
    }


})

/**
 * Setup logic for creating new flights
 */
$('#new-flight-btn').click(function(event){
    console.log('new flight button handler got: ', event)
    let btn = event.delegateTarget
    let appId = btn.getAttribute('app-id')
    let flightName = $('#new-flight-name').val()

    services.createFlight(appId, flightName, _DEFAULT_FLIGHT_DOMAIN)
        .then(_=>services.getFlightList(appId)
        .then((flights)=>{
            const createdFlight = flights.find(flight=>flight.name === flightName)
            return stateManager.selectedFlight(createdFlight)
        })
        .then(_=>refreshUI())
        .then(_=>services.getFlightToken())
        .then((data)=>stateManager.flightAuthToken(data.flightAuthorisationToken)))
        .then(_=>backToMainFrame())

})





//Handlers

function handleJWTError(err){

    if(err.code === 'ERR_NETWORK'){ //This can happen if the LogUI server is using a self-signed certificate. 
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


function appListHandler(response){
    console.log("Got application list: ", response)

    //Handle case where there are no applications.
    if(response.length == 0){
        const entry = $(`
        <div class='app-entry'>
        <p>There are no registered applications. You can register applications using the LogUI server admin app.</p>
        </div>`)
        $('#app-list').append(entry)
        return
    }

    //Handle case where there are applications
    response.forEach( function (app,index){
        //Create entries for each applicaiton with a select button.
        let app_entry = $(`
        <div index=${index} id='${app.id}' class='app-entry'>
        <span class="app-name">${app.name}</span>
        
        <span id='${app.id}-select'></span>
        </div>`)

        $('#app-list').append(app_entry)
        $(`#${app.id}-select`).button({
            icon: 'fa-solid fa-arrow-right'
        }).click( function(event){

            stateManager.selectedApp(app) //Persist the chosen app as the selected app
                .then(_=>services.getFlightList(app.id) //Then get the flight list for this app
                .then((flights)=>startFlightSelect(app, flights))) //Then start flight selection UI

        })
    })
}



function start(){




    /**
     * On start up check to see if we have a jwt for communicating with the LogUI Server.
     * If so, go get the app list from the LogUI server.
     * 
     * If no jwt exists, go fetch one from the server using the default username and password
     * stored in constants.js. If fetching one fails, handle that error assuming it's a self-signed
     * cert issue. 
     */

    stateManager.jwt().then(
        (jwt)=>services.getLogUIAppList().then(appListHandler),
        _=>Promise.all([
            stateManager.username(),
            stateManager.password()
        ]).then((values)=>{
            const username = values[0]
            const password = values[1]
            
            services.getJWT(username,password)
            .then(
                _=>services.getLogUIAppList().then(appListHandler),
                handleJWTError
            )
        })
        
        

    )
}

document.addEventListener('DOMContentLoaded', start);




