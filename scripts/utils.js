// UTILITY FUNCTIONS


/**
 * Cannot use crypto.randomUUID() as that won't work in content scripts 
 * not running from https. 
 * 
 * Used to uniquely identify messages sent via Abstract Connections.
 * 
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
     * Register a function to invoke when recieving a message of a particular type.
     * @param {String} type 
     * @param {Function} handler 
     */
    on(type, handler){
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
        if(data._id === undefined){
            data._id = uuid()
        }
        console.debug(`[${this.origin}][PORT:${this.name}][REQUEST:${data._id}][${data.type}] ${JSON.stringify(data, null, 4)}`)
        this.successMap.set(data._id, onSuccess !== undefined?onSuccess:_=>this.genericSuccessHandler())
        this.errorMap.set(data._id, onError !== undefined?onError:(err)=>this.genericErrorHandler(err))

        console.debug(`${this.name} set maps for ${data._id}`)
        console.debug(this.successMap)
        console.debug(this.errorMap)
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
            console.debug(msg._id)
            console.debug(this.errorMap)

            //TODO: this is kind of a band aid. It is strange that there are a lot of missing map entries. In theory, it shouldn't be possible to recieve an error for a request you did not send.
            if(this.errorMap.has(msg._id)){
                this.errorMap.get(msg._id)(msg)
                this.errorMap.delete(msg._id)
            }

        }else{
            //If there is no err_msg, fire the onSuccess function for this request
            console.debug(msg._id)
            console.debug(this.successMap)
            //TODO: this is kind of a band aid. It is strange that there are a lot of missing map entries. In theory, it shouldn't be possible to recieve an success for a request you did not send.
            if(this.successMap.has(msg._id)){ 
                this.successMap.get(msg._id)(msg)
                this.successMap.delete(msg._id)
            }

        }
        //In either case remove the message from the maps once handled
        
        
    }

    genericErrorHandler(err){
        console.error('An error occurred! ', err)
    }

    genericSuccessHandler(){
        //TODO: maybe log something here? 
    }

}

/**
 * This is a separate class so that we can maintain the handler signature of just accepting a data object.
 * 
 * A handler wrapper that manages message ids and facilitates responses from the handler provided
 * to the on(type, handler) function in AbstractConnection.
 * 
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
        /**
         * Note: if you get a strange this.handler(...) is undefined error here. The handler function doesn't return anything. 
         * It should return a promise. 
         */

        this.handler(data).then((result)=>{
            //Handle successful handler result
            result._id = _id
            result._id = data._id
            console.debug(`[${this.conn.origin}#${data.type}][RESPONSE: ${data._id}] ${JSON.stringify(result, null, 4)}`)

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

/**
 * This type of connection is only usable by extension scripts, and won't work from page scripts.
 */
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

/**
 * This type of connection is usable by page scripts. It's how scripts embedded into the page by main.js can 
 * communicate with main.js. 
 */
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
        this.name = `from-${counterparty}-to-${origin}`
        console.debug(`handling window messages with: ${this.handleResponse.toString()}`)
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
        if(
            msg.source === window &&
            msg?.data?.direction === this.counterparty
        ){
            super.handleResponse(msg.data)
        }
    }

    send(data, onSuccess, onError){
        super.send(data, onSuccess, onError)
        console.debug(`sending and will invoke on success: ${onSuccess?.toString()}`)

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
        // console.debug(`sendFunctionResult: ${JSON.stringify(data, null, 4)}`)
        window.postMessage(data)
    }
}