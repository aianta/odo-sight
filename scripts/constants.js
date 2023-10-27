/**
 * LOG UI Server
 */
_LOG_UI_SERVER_HOST = "localhost:8000"
_LOG_UI_JWT_PATH = "/api/user/auth/"
_LOG_UI_APP_LIST_PATH = "/api/application/list/"
_LOG_UI_FLIGHT_LIST_PATH = "/api/flight/list/"
_LOG_UI_FLIGHT_CREATE =  function(appId){return `/api/flight/${appId}/add/`}
_LOG_UI_FLIGHT_TOKEN_PATH = function(flightId){return `/api/flight/info/${flightId}/token/`}
_LOG_UI_DEFAULT_USERNAME = "aianta"
_LOG_UI_DEFAULT_PASSWORD = "01134hello"
_LOG_UI_PROTOCOL = "https"

/**
 * Odo Sight Internal constants
 */
CONTROLS_TO_BACKGROUND_PORT_NAME = "controls<->background"
CONTENT_SCRIPTS_TO_BACKGROUND_PORT_NAME = "content scripts<->background"
DEVTOOLS_TO_BACKGROUND_PORT_NAME = "devtools<->background"


/**
 * Odo Sight Option defaults
 */
_DEFAULT_FLIGHT_DOMAIN = "localhost:8088"

/**
 * Odo Sight Support 
 */
_ODO_BOT_SIGHT_SERVER_HOST = "localhost:8079"
_ODO_BOT_SIGHT_CONNECTION_CHECK_PATH = "/odo-sight/alive"
_ODO_BOT_SIGHT_SCRAPE_MONGO_PATH = "/odo-sight/scrape-mongo"