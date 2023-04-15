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
            if(!isEmptyObject(response) && response.selected_flight !== undefined){
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

/**
 * Cannot use crypto.randomUUID() as that won't work in content scripts 
 * not running from https. 
 * https://stackoverflow.com/questions/105034/how-do-i-create-a-guid-uuid
 * @returns a uuid
 */
function uuid() {
    return ([1e7]+-1e3+-4e3+-8e3+-1e11).replace(/[018]/g, c =>
      (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)
    );
  }

  /**
   * Used by non-background scripts to communicate with the background script.
   */
class BackgroundConnection{
    constructor(name){
        this.name = name;
        this.port = browser.runtime.connect({name:name})
        this.successMap = new Map()
        this.errorMap = new Map()
        this.invokeMap = new Map() //For reacting to requests FROM the background script
        this.port.onMessage.addListener((msg)=>this.handleResponse(msg))
    }

    /**
     * Register a function to invoke when background scripts sends
     * a message of a particular type.
     * @param {String} type 
     * @param {Function} handler 
     */
    on(type, handler){
        this.invokeMap.set(type, handler)
    }

    /**
     * Sends data to the background script and registers functions to 
     * invoke on successful response, and error response from the background
     * script.
     * @param {Object} data data to send
     * @param {Function} onSuccess function to invoke on successful response
     * @param {Function} onError function to invoke on error response
     */
    send(data, onSuccess, onError){
        data._id = uuid()
        console.debug(`[PORT:${this.name}][REQUEST:${data._id}][${data.type}] ${JSON.stringify(data, null, 4)}`)
        this.port.postMessage(data)
        this.successMap.set(data._id, onSuccess)
        this.errorMap.set(data._id, onError !== undefined?onError:(err)=>this.genericErrorHandler(err))
    }

    handleResponse(msg){
        console.debug(`[PORT:${this.name}][RESPONSE:${msg._id}] ${JSON.stringify(msg,null, 4)}`)
        
        //If the message has a type, it is a request message from the background script
        //Invoke any registered function here.
        if(msg.type !== undefined){
            this.invokeMap.get(msg.type)(msg)
            return
        }
        
        //If there is an err_msg, fire the onError function for this request
        if(msg.err_msg !== undefined){
            this.errorMap.get(msg._id)(msg)
        }else{
            //If there is no err_msg, fire the onSuccess function for this request
            this.successMap.get(msg._id)(msg)
        }
        //In either case remove the message from the maps once handled
        this.errorMap.delete(msg._id)
        this.successMap.delete(msg._id)
    }

    genericErrorHandler(err){
        console.error('An error occurred! ', err)
    }

}