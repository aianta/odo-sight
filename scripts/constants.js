/**
 * LOG UI Server
 */
//_LOG_UI_SERVER_HOST = "localhost:8000" //TODO Make this configurable via addon options
_LOG_UI_JWT_PATH = "/api/user/auth/"
_LOG_UI_APP_LIST_PATH = "/api/application/list/"
_LOG_UI_FLIGHT_LIST_PATH = "/api/flight/list/"
_LOG_UI_FLIGHT_CREATE =  function(appId){return `/api/flight/${appId}/add/`}
_LOG_UI_FLIGHT_TOKEN_PATH = function(flightId){return `/api/flight/info/${flightId}/token/`}
_LOG_UI_PROTOCOL = "https"

/**
 * Odo Sight Internal constants
 */
CONTENT_SCRIPTS_TO_BACKGROUND_PORT_NAME = "content scripts<->background"

/**
 * Odo Sight state
 */
_ODO_SIGHT_VALID_STATE_VERISON = "0.2"

/**
 * Odo Sight Support 
 */
_ODO_BOT_SIGHT_SCRAPE_MONGO_PATH = "/odo-sight/scrape-mongo/v2"

/**
 * The version of the protocol OdoX speaks with OdoBot, see odoBotSocket.js. OdoBot refuses sockets of any other version.
 */
_ODOBOT_PROTOCOL_VERSION = 2

/**
 * The URL of OdoX's socket to OdoBot. The clientId and protocol in the query let OdoBot bind the socket to its OdoClient
 * during the handshake, before any message.
 */
_ODOBOT_SOCKET_URL = function(guidanceHost, clientId){return `wss://${guidanceHost}/?clientId=${encodeURIComponent(clientId)}&protocol=${_ODOBOT_PROTOCOL_VERSION}`}

/**
 * The name of the ports main.js opens to the background, which carry guidance.js's messages to and from OdoBot, see
 * guidanceRelay.js.
 */
_GUIDANCE_PORT_NAME = "guidance"
