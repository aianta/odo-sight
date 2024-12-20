/**
 * LOG UI Server
 */
_LOG_UI_SERVER_HOST = "localhost:8000" //TODO Make this configurable via addon options
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
_ODO_SIGHT_VALID_STATE_VERISON = "0.1"

/**
 * Guidance service
 */
_GUIDANCE_SERVICE_OPTIONS_PATH = "/api/targetNodes"

/**
 * Odo Sight Support 
 */
_ODO_BOT_SIGHT_SCRAPE_MONGO_PATH = "/odo-sight/scrape-mongo/v2"