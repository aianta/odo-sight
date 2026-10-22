
/**
 * The form is filled from OdoX's state asynchronously. Anything that types into it, such as OdoBot's harness through
 * Selenium, must wait until it has been filled, or a late fill overwrites or garbles what was typed. So the form is
 * filled exactly once, after OdoX's state has been initialized and the default LogUI config is in place, and then
 * gets data-loaded="true". Likewise, it gets data-saved="true" once a save has been written to storage.
 */
async function initOptions(){
    await stateManager.ready()

    //Setup default logUI config if the current state is just an empty object
    const currentConfig = await stateManager.logUIConfig().catch(_=>({}))
    if(currentConfig === undefined || Object.keys(currentConfig).length === 0){
        await stateManager.logUIConfig(_defaultConfig)
    }

    await loadOptions()
    document.querySelector('form').dataset.loaded = 'true'
}


async function saveOptions(e){
    e.preventDefault();
    const form = document.querySelector('form')
    form.dataset.saved = 'false'

    //Hide exisiting errors, hopefully they've been fixed.
    document.querySelector('.error-box').classList.remove('visible')
    document.querySelector('.error-box').classList.add('hidden')


    const writes = []
    try{
        let configValue = JSON.parse(document.querySelector('#logui-client-config').value)
        writes.push(stateManager.logUIConfig(configValue))
    }catch(error){
        console.error(error)
        showLogUIConfigError(error)
    }


    writes.push(
        stateManager.host(document.querySelector("#logui-server-host").value),
        stateManager.guidanceHost(document.querySelector("#guidance-host").value),
        stateManager.username(document.querySelector("#logui-server-username").value),
        stateManager.password(document.querySelector('#logui-server-password').value),
        stateManager.endpoint(document.querySelector('#logui-server-endpoint').value),
        stateManager.targetHost(document.querySelector('#target-host').value),
        stateManager.odoSightSupportHost(document.querySelector('#odo-sight-support-host').value)
    )

    await Promise.all(writes)
    form.dataset.saved = 'true'
}

/**
 * Fill the form from OdoX's state.
 * @returns a promise that resolves once every field has been filled.
 */
function loadOptions(){

    return Promise.all([
        stateManager.host().then((host)=>{document.querySelector("#logui-server-host").value = host}, _=>{document.querySelector("#logui-server-host").value = ''}),
        stateManager.guidanceHost().then((guidanceHost)=>{document.querySelector("#guidance-host").value = guidanceHost},  _=>{document.querySelector("#guidance-host").value = ''}),
        stateManager.username().then((username)=>{document.querySelector("#logui-server-username").value = username},_=>{document.querySelector("#logui-server-username").value = ''}),
        stateManager.password().then((password)=>{document.querySelector('#logui-server-password').value = password},_=>{document.querySelector('#logui-server-password').value = ''}),
        stateManager.endpoint().then((endpoint)=>{document.querySelector('#logui-server-endpoint').value = endpoint},_=>{document.querySelector('#logui-server-endpoint').value = ''}),
        stateManager.logUIConfig().then((config)=>{document.querySelector('#logui-client-config').value = JSON.stringify(config, null, 4)}, _=>{}),
        stateManager.targetHost().then((targetHost)=>{document.querySelector('#target-host').value = targetHost},_=>{document.querySelector('#target-host').value = ''}),
        stateManager.odoSightSupportHost().then((odoSightSupportHost)=>{document.querySelector('#odo-sight-support-host').value = odoSightSupportHost}, _=>{document.querySelector('#odo-sight-support-host').value = ''})
    ])
}

function showLogUIConfigError(message){
    document.querySelector('#config-value-error-msg').innerHTML = message

    document.querySelector(".error-box").classList.remove('hidden')
    document.querySelector(".error-box").classList.add('visible')
}


document.addEventListener('DOMContentLoaded', ()=>{
    initOptions().catch(err=>console.error('Could not load the options', err))
})
document.querySelector("form").addEventListener("submit", saveOptions);
