// UTILITY FUNCTIONS
//https://stackoverflow.com/questions/679915/how-do-i-test-for-an-empty-javascript-object
function isEmptyObject(obj){
    return obj // 👈 null and undefined check
        && Object.keys(obj).length === 0
        && Object.getPrototypeOf(obj) === Object.prototype
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