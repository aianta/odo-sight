// UTILITY FUNCTIONS

/**
 * Post a message to a port, retrying if an error occurs. 
 * This is helpful when capturing network requests that occur just
 * before a page in unloaded. 
 * 
 * @param {*} message the message to send.
 * @param {*} port the port to send the message on.
  */
function postWithRetry(port, message){
    return recursivePostWithRetry(port, message, 0)
}

function recursivePostWithRetry(port, message, attempt){
    console.log(`[Attempt: ${attempt} ] Trying to postMessage...`)
    try{
        port.postMessage(message)
    }catch(error){
        console.log(error)
        if(attempt <= 10){ //Limit to 10 retries
            setTimeout(()=>recursivePostWithRetry(port,message, attempt+1), 15000)
        }
    }
}


//https://stackoverflow.com/questions/679915/how-do-i-test-for-an-empty-javascript-object
function isEmptyObject(obj){
    return obj // 👈 null and undefined check
        && Object.keys(obj).length === 0
        && Object.getPrototypeOf(obj) === Object.prototype
}



/**
 * Returns selected flight stored in local storage.
 */
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

/**
 * Returns any JWT token stored locally.  
 */
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
class AbstractConnection{
    constructor(origin){
        this.origin = origin
        this.successMap = new Map()
        this.errorMap = new Map()
        this.invokeMap = new Map() //For reacting to requests FROM the background script
    }

    /**
     * Register a function to invoke when background scripts sends
     * a message of a particular type.
     * @param {String} type 
     * @param {Function} handler 
     */
    on(type, handler){
        console.log(`I'm (${this}) gonna use my send function ${this.sendFunction.toString()}`)
        let wrapper = new OnHandlerWrapper(handler, this, this.sendFunction)
        this.invokeMap.set(type, wrapper)
    }

    sendFunction(){
        throw new Error("sendFunction not implemented by subclass!")
    }

    /**
     * Injects a uuid into the data object to be sent and registers functions to invoke 
     * on sucessful response, and on error response from the other party. Additionally 
     * logs the send request to the console.
     * 
     * Note: does not actually send the data, that is left to the implementing subclasses. 
     * 
     * @param {Object} data data to send
     * @param {Function} onSuccess function to invoke on successful response
     * @param {Function} onError function to invoke on error response
     */
    send(data, onSuccess, onError){
        data._id = uuid()
        console.debug(`[${this.origin}][PORT:${this.name}][REQUEST:${data._id}][${data.type}] ${JSON.stringify(data, null, 4)}`)
        this.successMap.set(data._id, onSuccess)
        this.errorMap.set(data._id, onError !== undefined?onError:(err)=>this.genericErrorHandler(err))
    }

    /**
     * Handles a message arriving on the connection.
     * 
     * There are two primary cases:
     * 
     * CASE 1: The message on the connection is a direct request from the other party.
     * In this case we look to invoke some function from the invoke map based on the type 
     * of the request.
     * 
     * CASE 2: The message on the connection is a response to a request initially made
     * on the connection. In this case we look to  invoke the specific success or error callback
     * registered when the request was made. Responses are mapped to callbacks via their unique
     * uuids.
     * 
     * @param {Object} msg 
     * @returns 
     */
    handleResponse(msg){
        console.debug(`[${this.origin}][PORT:${this.name}][RESPONSE:${msg._id}] ${JSON.stringify(msg,null, 4)}`)
        
        //Handle CASE 1
        //If the message has a type, it is a request message from the background script
        //Invoke any registered function here.
        if(msg.type !== undefined){
            console.debug(`${JSON.stringify(msg, null, 4)}`)
            console.debug(`[${this.origin}] looking to invoke handler for message type:${msg.type}`)
            this.invokeMap.get(msg.type).wrapper(msg)
            return
        }

        //Handle CASE 2
        
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

/**
 * This is a separate class so that we can maintain the handler signature of just accepting a data object.
 * 
 * A handler wrapper that manages message ids and facilitates responses from the handler provided
 * to the on(type, handler) function in AbstractConnection.
 * @param {Function} handler the handler to wrap
 * @param {Object} conn parent connection
 * @param {Function} sendFunc a function that facilitates sending on the connections underlying mechanism.
 */
class OnHandlerWrapper {
    constructor(handler, conn, sendFunction){
        this.handler = handler
        this.conn = conn
        this.sendFunction = sendFunction

    }

    wrapper(data){
        console.debug(`[${this.conn.origin}#${data.type}][REQUEST:${data._id}] ${JSON.stringify(data, null, 4)}`)
        let _id = data._id
        this.handler(data).then((result)=>{
            //Handle successful handler result
            result._id = _id
            console.debug(`[${this.conn.origin}#${data.type}][RESPONSE: ${data._id}] ${JSON.stringify(result, null, 4)}`)
            // conn.port.postMessage(result)
            this.sendFunction(result)
        }).catch((err)=>{
            //Handle handler failure/error
            let error_object = {
                _id: _id,
                //TODO: this might not be robust enough for all exceptions, built to handle axios failure.
                err_msg: typeof err === 'object'?err.message:err
            }
            console.debug(`[${this.conn.origin}#${data.type}][RESPONSE:${error_object._id}] ${JSON.stringify(error_object, null, 4)}`)
            // conn.port.postMessage(error_object)
            this.sendFunction(error_object)
        })
    }
}

class PortConnection extends AbstractConnection {
    /**
     * 
     * @param {String} name name of the port to create and manage.
     * @param {String} origin a name indentifying the creator of the port connection. IE: main.js 
     */
    constructor(name, origin){
        super(origin)
        this.name = name
        this.port = browser.runtime.connect({name:name})
        this.port.onMessage.addListener((msg)=>super.handleResponse(msg))
    }

    send(data, onSuccess, onError){
        super.send(data, onSuccess, onError)
        this.sendFunction(data)
    }
    /** 
    * 'this' in the below context could refer to the OnHandlerWrapper calling 'sendFunction'
    * in which case we get the port by going through the conn.port field accessors.
    */
    sendFunction(data){
        let _port = this.port === undefined?this.conn.port:this.port
        _port.postMessage(data)
    }
}

class WindowConnection extends AbstractConnection {

    /**
     * 
     * @param {String} origin name identifying the creator of the window connection. IE: handlerMagic.js
     * @param {String} counterparty name identifying the counterparty for this connection (who it's connecting *to*). 
     */
    constructor(origin, counterparty){
        super(origin)
        this.direction = `from-${origin}`
        this.counterparty = `from-${counterparty}`
        console.log(`handling window messages with: ${this.handleResponse.toString()}`)
        window.addEventListener("message", (msg)=>this.handleResponse(msg))
    }

    handleResponse(msg){
        /**
         * For window connections we're really just using the DOM event system,
         * so we have to make sure we're only responding to the correct kind of 
         * events. That is:
         * * The source of the event is the window.
         * * The direction of the event is 'from-<counter-party>', we don't want to 
         * invoke our response handler off the message *we* sent.
         * 
         */
        
        console.log(`[${this.origin}] Got event from ${msg.source}: ${JSON.stringify(msg.data, null, 4)}`)
        console.log(`[${this.origin}] msg.source === window: ${msg.source === window}`)
        console.log(`[${this.origin}] msg?.data?.direction === ${this.counterparty}: ${msg?.data?.direction === this.counterparty}`)
        if(
            msg.source === window &&
            msg?.data?.direction === this.counterparty
        ){
            super.handleResponse(msg.data)
        }
    }

    send(data, onSuccess, onError){
        super.send(data, onSuccess, onError)
        console.log(`sending and will invoke on success: ${onSuccess?.toString()}`)

        this.sendFunction(data)
    }

    sendFunction(data){
        /**
         * Set the direction of the data, javascript is a real piece of work here.
         * TODO: if there are problems this could be why. 
         * 
         * 'this' in the below context could refer to the OnHandlerWrapper calling 'sendFunction'
         * in which case we get the direction by going through the conn.direction field accessors.
         */
        data.direction = this.direction === undefined?this.conn.direction:this.direction
        console.log(`sendFunctionResult: ${JSON.stringify(data, null, 4)}`)
        window.postMessage(data)
    }
}