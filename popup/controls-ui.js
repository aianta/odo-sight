console.log('controls-ui.js says hi!')


$('#app-select-frame').addClass('hidden')
$('#flight-select-frame').addClass('hidden')

$('#start-btn').button({
    icon: 'fa-solid fa-circle red'
}).click(_=>stateManager.set('shouldRecord', true))

$('#stop-btn').button({
    icon: 'fa-solid fa-square black'
}).click(_=>stateManager.set('shouldRecord', false))

$('#flight-back-btn').button({
    icon: 'fa-solid fa-arrow-left'
}).click(backToMainFrame)

$('#app-back-btn').button({
    icon: 'fa-solid fa-arrow-left'
}).click(backToMainFrame)

$('#scrape_mongo_btn').button({
    label:'Scrape Mongo'
})

$('#send_flight_token')
.button({
    icon: 'fa-solid fa-file-import'
})

$('#edit_flight_btn').button({
    icon: "fa-solid fa-wrench"
}).click(startAppSelect)

$('#new-flight-btn').button({
    icon: "fa-solid fa-plus"
})

function refreshUI(){

    stateManager.sessionId().then((sessionId)=>$('#session_id').text(sessionId),_=>$('#session_id').text('<no active session>'))

    //Update UI as a function of whether a flight is selected or not.
    stateManager.selectedFlight()
    .then(function(flight){
            //There exists a selected flight
            $('#no-flight-instructions').addClass('hidden').removeClass('visible')
            $('#flight-label').addClass('visible').removeClass('hidden')
            $('#flight_id').text(flight.id)
            $('#flight_name').text(flight.name)

            //Show recording controls
            $('#recording-controls').addClass('visible').removeClass('hidden')
        },
        _=>{
            //There does not exist a selected flight
            $('#no-flight-instructions').addClass('visible').removeClass('hidden')
            $('#flight-label').addClass('hidden').removeClass('visible')

            //Hide recording controls
            $('#recording-controls').addClass('hidden').removeClass('visible')
        })

    //Update UI as a function of the recording state.
    Promise.all(
        [
            stateManager.get('shouldRecord'),
            stateManager.get('isRecording')
        ]
    ).then((values)=>{
        const shouldRecord = values[0]
        const isRecording = values[1]

        if(shouldRecord){
            $('#stop-recording').addClass('visible').removeClass('hidden')
            $('#start-recording').addClass('hidden').removeClass('visible')
            return Promise.resolve()
        }

        if(!shouldRecord){
            $('#start-recording').addClass('visible').removeClass('hidden')
            $('#stop-recording').addClass('hidden').removeClass('visible')
            return Promise.resolve()
        }

        //Otherwise hide everything.
        $('#start-recording').addClass('hidden').removeClass('visible')
        $('#stop-recording').addClass('hidden').removeClass('visible')

    })
}

refreshUI()


function observeStateChange(changes){
    refreshUI()

    if ('sessionId' in changes){
        $('#session_id').text(changes['sessionId'].newValue)
    }
    
}

browser.storage.local.onChanged.addListener(observeStateChange)




function showError(msg){
    $('#error-container').removeClass('hidden').addClass('visible')
    $('#error-msg').text(msg)
}

function clearError(){
    $('#error-msg').text('')
    $('#error-container').addClass('hidden').removeClass('visible')
}

/**
 * 
 * @param {*} statusLabel 'logui-status', 'dom-effects-status', or 'network-events-status'
 * @param {*} statusValue 'green', 'red', 'orange', 'black'
 */
function setStatus(statusLabel, statusValue){
    $(`#${statusLabel}`).removeClass('black').removeClass('green').removeClass('orange').removeClass('red')
    $(`#${statusLabel}`).addClass(`${statusValue}`)

    if(statusLabel === 'logui-status' && statusValue === 'green'){
        $('#stop-btn').button({disabled:false})
    }

}

function startFlightSelect(app, flights){
    console.log('startFlightSelect got ', app,  flights)


    $('#flight-select-frame').addClass('visible').removeClass('hidden')
    $('#app-select-frame').addClass('hidden').removeClass('visible')
    $('#main-frame').addClass('hidden').removeClass('visible')
    
    $('#flight-app-name').text(app.name)

    $('#flight-list').empty()

    $('#new-flight-btn').attr('app-id', app.id)

    flights.sort(function(a,b){
        let aDate = Date.parse(a.creation_timestamp)
        let bDate = Date.parse(b.creation_timestamp)

        return bDate - aDate
    })

    flights.forEach(function(flight, index){
        let flight_entry = $(`
            <div index=${index} id='${flight.id}' class='flight-entry'>
            <span class='flight-name'>${flight.name}</span>
            <span id='${flight.id}-select'></span>
            </div>
        `)

        $('#flight-list').append(flight_entry)
        $(`#${flight.id}-select`).button({
            icon: 'fa-solid fa-check'
        }).click(function(event){
            
            stateManager.selectedFlight(flight)
                .then(_=>refreshUI())
                .then(_=>services.getFlightToken()
                .then((data)=>stateManager.flightAuthToken(data.flightAuthorisationToken)))
            
            backToMainFrame()
          
        })
    })

}

function backToMainFrame(){
    $('#main-frame').addClass('visible').removeClass('hidden')
    $('#flight-select-frame').addClass('hidden').removeClass('visible')
    $('#app-select-frame').addClass('hidden').removeClass('visible')

    // getSelectedFlight().then(function(selected_flight){
    //     $('#flight_id').text(selected_flight.id)
    //     $('#flight_name').text(selected_flight.name)
    // })
}

function startAppSelect(){
    $('#main-frame').addClass('hidden').removeClass('visible')
    $('#flight-select-frame').addClass('hidden').removeClass('visible')
    $('#app-select-frame').addClass('visible').removeClass('hidden')
}