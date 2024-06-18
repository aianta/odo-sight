/**
 * Back to menu button,
 * sets the popup to the menu view, and then changes the window 
 * location to the menu view.
 */

$('#back-to-menu-btn').button({
    icon: 'fa-solid fa-arrow-left',
    label: 'Back to Menu'
}).click(_=>{
    browser.action.setPopup({
        popup: '/popup/menu/menu.html'
    })
    window.location.href="/popup/menu/menu.html"
})

/**
 * Fetch and populate the guidance options dropdown.
 */
services.getGuidanceOptions().then((options)=>{

    $('#target-node-select').empty() //Clear the dummy/placeholder/previous options

    options.forEach(option=>{
        $('#target-node-select').append(
            $('<option></option>').attr("value", option.id).text(`${option.method}-${option.path}`)
        )
    })

})






/**
 * This runs once when the bot view is loaded.
 * Decide what button to display based on whether or not 
 * there is an active paths request. 
 */
stateManager.exists('activePathsRequestId').then(
    exists=>{
        if(exists){
            /**
             * If a paths request exits, hide the button
             * that creates a paths request. And show the
             * button that cancels an existing paths request.
             */
            $('#guide-btn').button({
                label: 'GO'
            }).hide()
            $('#cancel-btn').button({
                label: 'Stop Guidance',
            }).show()
        }else{
            /**
             * Otherwise show the button that creates a paths
             * request, and hide the button that cancels an
             * existing paths request.
             */
            $('#guide-btn').button({
                label: 'GO'
            }).show()
            $('#cancel-btn').button({
                label: 'Stop Guidance',
            }).hide()
        }
        
    }
)

/**
 * Bind a change listener to the extension state to update
 * button visibility based on wheteher or not there is 
 * an active paths request.
 * This keeps the correct buttons showing after the bots view
 * is loaded.
 */
browser.storage.local.onChanged.addListener(observeStateChange)

function observeStateChange(changes){
    if('activePathsRequestId' in changes && changes['activePathsRequestId'].newValue){
        $('#guide-btn').hide()
        $('#cancel-btn').show()
    }
    
    if('activePathsRequestId' in changes && !changes['activePathsRequestId'].newValue){
        $('#guide-btn').show()
        $('#cancel-btn').hide()
    }
}

function showError(msg){
    $('#error-container').removeClass('hidden').addClass('visible')
    $('#error-msg').text(msg)
}

function clearError(){
    $('#error-msg').text('')
    $('#error-container').addClass('hidden').removeClass('visible')
}


function hideSelfSignedCertificateError(){
    //If the main frame was hidden, display it again.
    if($('#main-frame').hasClass('hidden')){
        $('#main-frame').removeClass('hidden').addClass('visible')
    }

    //If the self signed cert msg box is visible, hide it.
    if( $('#self-signed-ssl-msg-box').hasClass('visible')){
        $('#self-signed-ssl-msg-box')
            .removeClass('visible')
            .addClass('hidden')
    }
}

function handleSelfSignedCertificateError(error, retryFunction){

    if(error.code === 'ERR_NETWORK'){

        //Hide the main frame
        $('#main-frame').addClass('hidden').removeClass('visible')

        const selfSignedLinkTarget = error.hostLink
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

            retryFunction && retryFunction()
                .then(
                    _=>{},
                    err=>handleSelfSignedCertificateError(err, retryFunction)
                )
            
        }, 20000) //20 seconds.


    }

    

}

