// UTILITY FUNCTIONS
//https://stackoverflow.com/questions/679915/how-do-i-test-for-an-empty-javascript-object
function isEmptyObject(obj){
    return obj // 👈 null and undefined check
        && Object.keys(obj).length === 0
        && Object.getPrototypeOf(obj) === Object.prototype
}

getSelectedFlight = function(){
    return browser.storage.local.get("selected_flight").then(
        function(response){
            if(!isEmptyObject(response && response.selected_flight !== undefined)){
                return Promise.resolve(response.selected_flight)
            }else{
                return Promise.reject("No selected_flight value exists in local storage")
            }
        }
    )
}

getLocalJWT = function(){
    return browser.storage.local.get("logui_jwt").then(
        function(response){
            if (!isEmptyObject(response) && response.logui_jwt !== undefined){
                return Promise.resolve(response.logui_jwt)
            }else{
                return Promise.reject("No logui JWT token in local storage")
            }
        }
    )
}