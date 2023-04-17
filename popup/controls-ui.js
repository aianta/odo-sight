console.log('controls-ui.js says hi!')

// $('#logui-status').addClass('green')
// $('#dom-effects-status').addClass('green')
// $('#network-effects-status').addClass('green')

$('#app-select-frame').addClass('hidden')
$('#flight-select-frame').addClass('hidden')

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

getSelectedFlight().then(function(selected_flight){
    $('#flight_id').text(selected_flight.id)
    $('#flight_name').text(selected_flight.name)
})


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
 * @param {*} statusValue 'green', 'red', 'orange'
 */
function setStatus(statusLabel, statusValue){
    $(`#${statusLabel}`).addClass(`${statusValue}`)
}

function startFlightSelect(app, flights){
    console.log('startFlightSelect got ', app , flights)

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
            browser.storage.local.set({selected_flight: flight})
            backToMainFrame()
            conn.send({
                type:'SET_FLIGHT_TOKEN'
            }, ()=>console.log("This should never run maybe."))
        })
    })

}

function backToMainFrame(){
    $('#main-frame').addClass('visible').removeClass('hidden')
    $('#flight-select-frame').addClass('hidden').removeClass('visible')
    $('#app-select-frame').addClass('hidden').removeClass('visible')

    getSelectedFlight().then(function(selected_flight){
        $('#flight_id').text(selected_flight.id)
        $('#flight_name').text(selected_flight.name)
    })
}

function startAppSelect(){
    $('#main-frame').addClass('hidden').removeClass('visible')
    $('#flight-select-frame').addClass('hidden').removeClass('visible')
    $('#app-select-frame').addClass('visible').removeClass('hidden')
}