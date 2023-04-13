console.log('controls-ui.js says hi!')

// $('#logui-status').addClass('green')
// $('#dom-effects-status').addClass('green')
// $('#network-effects-status').addClass('green')

$('#app-select-frame').addClass('hidden')
$('#flight-select-frame').addClass('hidden')

$('#flight-back-btn').button({
    icon: 'fa-solid fa-arrow-left'
})

$('#app-back-btn').button({
    icon: 'fa-solid fa-arrow-left'
}).click(backToMainFrame)

$('#scrape_mongo_btn').button({
    label:'Scrape Mongo'
})

$('#edit_flight_btn').button({
    icon: "fa-solid fa-wrench"
}).click(startAppSelect)

/**
 * 
 * @param {*} statusLabel 'logui-status', 'dom-effects-status', or 'network-events-status'
 * @param {*} statusValue 'green', 'red', 'orange'
 */
function setStatus(statusLabel, statusValue){
    $(`#${statusLabel}`).addClass(`${statusValue}`)
}

function backToMainFrame(){
    $('#main-frame').addClass('visible').removeClass('hidden')
    $('#app-select-frame').addClass('hidden').removeClass('visible')
}

function startAppSelect(){
    $('#main-frame').addClass('hidden').removeClass('visible')
    $('#app-select-frame').addClass('visible').removeClass('hidden')
}