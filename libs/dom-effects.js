(function(){

    console.log("dom-effects ran!")

    const rootFields = [
        "outerHTML",
        "outerText"
    ]

    const nodeFields = [
        "async",
        "baseURI",
        "childElementCount",
        "className",
        "clientHeight",
        "clientLeft",
        "clientTop",
        "clientWidth",
        "id",
        "nodeName",
        "localName",
        "outerHTML",
        "innerHTML",
        "outerText",
        "textContent",
        "title",
        "type",
        "text"
    ]


    /**
     * https://stackoverflow.com/questions/19669786/check-if-element-is-visible-in-dom
     * @param {*} element 
     * @returns true if hidden
     */
    const isHidden = function(element){
        //TODO: fix for elements with postion: fixed.
        return (element.offsetParent === null)
    }

    /**
     * Returns a filtered snapshot of the DOM 
     */
    const captureDOMSnapshot = function(){
        document.querySelectorAll('*').forEach(node=>node.setAttribute('_odo_isHidden', isHidden(node)))

        const fullHtml = document.documentElement.outerHTML
        const scriptRegex = /<script[\s\S]*?>[\s\S]*?<\/script>/gi //https://stackoverflow.com/questions/16585635/how-to-find-script-tag-from-the-string-with-javascript-regular-expression
        const noScripts = fullHtml.replaceAll(scriptRegex, "") //Clear all scripts.
        const xmlCharacterDataRegex = /<!\[CDATA[\s\S]*\]\]>/gi 
        const noXMLCDATA = noScripts.replaceAll(xmlCharacterDataRegex, "") //Clear all XML character data
        const styleRegex = /<style[\s\S]*?>[\s\S]*?<\/style>/gi
        const noStyle = noXMLCDATA.replaceAll(styleRegex, "") //Clear all css styles
        const svgPathsRegex = /<path[\s\S]*?>[\s\S]*?<\/path>/gi
        const noSvgPaths = noStyle.replaceAll(svgPathsRegex, "") //Clear all paths inside SVGs

        let result = {
            outerHTML: noSvgPaths, 
            outerText: document.documentElement.outerText
        }

        return JSON.stringify(result)

    }

    // Generating XPath
    // https://stackoverflow.com/questions/3454526/how-to-calculate-the-xpath-position-of-an-element-using-javascript
    const getElementTreeXPath = function(element)
        {
            var paths = [];  // Use nodeName (instead of localName) 
            // so namespace prefix is included (if any).
            for (; element && element.nodeType == Node.ELEMENT_NODE; 
                element = element.parentNode)
            {
                var index = 0;
                var hasFollowingSiblings = false;
                for (var sibling = element.previousSibling; sibling; 
                    sibling = sibling.previousSibling)
                {
                    // Ignore document type declaration.
                    if (sibling.nodeType == Node.DOCUMENT_TYPE_NODE)
                        continue;

                    if (sibling.nodeName == element.nodeName)
                        ++index;
                }

                for (var sibling = element.nextSibling; 
                    sibling && !hasFollowingSiblings;
                    sibling = sibling.nextSibling)
                {
                    if (sibling.nodeName == element.nodeName)
                        hasFollowingSiblings = true;
                }

                var tagName = (element.prefix ? element.prefix + ":" : "") 
                                + element.localName;
                var pathIndex = (index || hasFollowingSiblings ? "[" 
                        + (index + 1) + "]" : "");
                paths.splice(0, 0, tagName + pathIndex);
            }

            return paths.length ? "/" + paths.join("/") : null;
        };

    // Helper function that strips data from fields listed in nodeFields and returns them in an object
    const stripDataFromNode = function(node, index){
        const data = {}

        //Also report XPATH
        data.xpath = getElementTreeXPath(node)
        if (data.xpath === null){
            return data // Don't bother doing any extra work for null xpath nodes
        }

        for (const property in node){
            if (nodeFields.includes(property)){
                data[property] = node[property]
            }
        }

        return data
    }

    // Helper function that strips data from list of nodes and returns stripped data in a list.
    const stripDataFromNodes = function(nodes){
        const data = []
        nodes.forEach((node)=>{
            // Don't bother getting data for elements with null xpath
            const nodeData = stripDataFromNode(node)
            if (nodeData.xpath !== null){
                data.push(stripDataFromNode(node, data.length))
            }

        })
        return data
    }


    /* Following the documentation from: 
     * https://developer.mozilla.org/en-US/docs/Web/API/MutationObserver
     */


    
    const observerOptions = {
        childList: true,
        attributes: true,
        attributeFilter: ['style'],
        characterData: true,
        subtree: true
    }

    const callback = (mutationList, observer) => {


        for (const mutation of mutationList){
            //Get an event details object ready
            let eventDetails = {
                name:'DOM_EFFECT'
            }

            
            /**
             * Watch for changes in the style attribute of elements, 
             * specifically for the 'isHidden' property. 
             * If 'isHidden' has changed since last we saw it, fire off the appropriate
             * 'show' or 'hide' log event.
             */
            if (mutation.type === 'attributes' &&
                isHidden(mutation.target) !== mutation.target.isHidden){

                    console.log("DOM EFFECT EVENT TIME: ", performance.now())

                    eventDetails.action = isHidden(mutation.target)? "hide":"show"
                    eventDetails.nodes = []
                    eventDetails.nodes.push(stripDataFromNode(mutation.target))
                    console.log("OLD isHidden:",mutation.target.isHidden, "NEW:", isHidden(mutation.target), "@", getElementTreeXPath(mutation.target))
                    //update the isHidden value
                    mutation.target.isHidden = isHidden(mutation.target)
            }

            if (mutation.type === "childList"){


                //If a node was added
                if(mutation.addedNodes.length > 0){
                    eventDetails.action = 'add'
                    eventDetails.nodes = stripDataFromNodes(mutation.addedNodes)
                    
                    //Mark elements with display CSS property set, store that 'last' display value in their properties.
                    //This allows us to fire off 'show' and 'hide' events on 'style' attribute mutations.
                    Array.from(mutation.addedNodes)
                        .filter(node=>node instanceof Element)
                        //.filter(node=>node instanceof Element && node.style.display !== "")
                        .forEach(element=>{
                            element.isHidden = isHidden(element)
                        })

                }

                //If a node was removed
                if(mutation.removedNodes.length > 0){
                    eventDetails.action = 'remove'
                    eventDetails.nodes = stripDataFromNodes(mutation.removedNodes)
                }


                
            }

            //Ensure LogUI is defined and active. Only log event if we have nodes to report
            if(window.LogUI && window.LogUI.isActive() && eventDetails.nodes && eventDetails.nodes.length > 0){
                
                
                // If there's only one node, move the xpath field out into eventDetails for convenience
                if(eventDetails.nodes.length === 1){
                    eventDetails.xpath = eventDetails.nodes[0].xpath
                }

                if(eventDetails.xpath === undefined){
                    console.log(eventDetails)
                }
                
                if(eventDetails.nodes.length === 1 && eventDetails.nodes[0].localName === 'script' || //Don't log scripts 
                   eventDetails.nodes[0].localName === 'style' //Don't log style elements
                   ){
                    return
                }
                
                console.debug(`passing eventDetails ${JSON.stringify(eventDetails, ["name", "action", "xpath"], 4)}`)
                eventDetails.domSnapshot = captureDOMSnapshot()
                
                //Stringify nodes before we send it
                eventDetails.nodes = JSON.stringify(eventDetails.nodes)

                window.LogUI.logCustomMessage(eventDetails)
            }

        }
    }

    const observer = new MutationObserver(callback);

    //Try and set up 'old' isHidden values for as many elements as we can. 
    document.querySelectorAll('*').forEach(node=>{
        node.isHidden = node.offsetParent === null
    })

    /* Getting the root element on the page
     * https://developer.mozilla.org/en-US/docs/Web/API/Document/documentElement
     */
    observer.observe(document.documentElement, observerOptions)


})(window)