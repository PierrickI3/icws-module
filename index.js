'use strict';

var querystring = require('querystring'),
    http = require('http'),
    https = require('https');

var ICWS = {
    applicationName: 'ICWS Node Module',
    URI_SCHEME: 'http://',
    URI_SERVER: 'localhost', // IC Server hostname or IP
    URI_PORT: '8018',
    URI_PATH: '/icws',
    PULL_MESSAGES_TIMEOUT: 2000,
    baseURI: function () {
        return this.URI_SCHEME + this.URI_SERVER + ':' + this.URI_PORT;
    },
    REQUEST_TIMEOUT_MS: 60000,
    MEDIA_TYPE: 'application/vnd.inin.icws+JSON',
    MEDIA_CHARSET: 'charset=utf-8',
}

module.exports.URL = ICWS.URL = {
    UserActivations: '/activations/users', // https://developer.inin.com/documentation/Documents/ICWS/WebHelp/icws/(sessionId)/activations/users/(userId)/index.htm#resource
    ImageResources: '/configuration/image-resources', // https://developer.inin.com/documentation/Documents/ICWS/WebHelp/icws/(sessionId)/configuration/image-resources/index.htm#resource
    Layouts: '/configuration/layouts', // https://developer.inin.com/documentation/Documents/ICWS/WebHelp/icws/(sessionId)/configuration/layouts/index.htm#resource
    Positions: '/configuration/positions', // https://developer.inin.com/documentation/Documents/ICWS/WebHelp/icws/(sessionId)/configuration/positions/(id)/index.htm#resource
    Users: '/configuration/users', // https://developer.inin.com/documentation/Documents/ICWS/WebHelp/icws/(sessionId)/configuration/users/(id)/index.htm#resource
    StatusMessages: '/status/status-messages', // https://developer.inin.com/documentation/Documents/ICWS/WebHelp/icws/(sessionId)/configuration/status-messages/(id)/index.htm#resource
    UserStatuses: '/status/user-statuses', // https://developer.inin.com/documentation/Documents/ICWS/WebHelp/icws/(sessionId)/status/user-statuses/(userId)/index.htm#resource
    Interactions: '/interactions/', // https://developer.inin.com/documentation/Documents/ICWS/WebHelp/icws/(sessionId)/interactions/Interactions.htm#application
    StructuredParameters: '/configuration/structured-parameters', //https://developer.inin.com/documentation/Documents/ICWS/WebHelp/icws/(sessionId)/configuration/structured-parameters
    ServerParameters: '/configuration/server-parameters', //https:developer.inin.com/documentation/Documents/ICWS/WebHelp/icws/(sessionId)/configuration/server-parameters
    Messages: '/messaging/messages', //https://developer.inin.com/documentation/Documents/ICWS/WebHelp/icws/(sessionId)/messaging/messages
    Connection: '/connection', //https://developer.inin.com/documentation/Documents/ICWS/WebHelp/icws/(sessionId)/connection/Connection.htm
}

module.exports.init = function(options) {

  // Validate parameters
  if (!options)
  {
    console.error('Missing options');
    throw new Error('Missing options');
  }

  if (!options.cicServer) {
    console.error('Missing cicServer');
    throw new Error('Missing cicServer');
  }

  if (!options.port) {
    console.error('Missing port');
    throw new Error('Missing port');
  }

  // Go!
  console.log('Starting with options:', options);

  if (options.uriScheme) {
    ICWS.URI_SCHEME = options.uriScheme;
  }

  if (options.applicationName) {
    ICWS.applicationName = options.applicationName;
  }

  if (options.cicServer) {
    ICWS.URI_SERVER = options.cicServer;
  }

  if (options.port) {
    ICWS.URI_PORT = options.port;
  }

  if (options.username && options.password) {
    if(options.loginSuccess) {
      ICWS.login(options.username, options.password, options.loginSuccess);
    } else {
      ICWS.login(options.username, options.password, function(){});
    }
  }
}

ICWS.query = function (method, requestPath, options, callback) {
  console.log("\n=> ICWS.query: ", method, requestPath, options);

  // Validate parameters
  if (!method)
  {
    console.error('Missing method');
    throw new Error('Missing method');
  }

  if (!requestPath)
  {
    console.error('Missing requestPath');
    throw new Error('Missing requestPath');
  }

  if (options.connected == undefined) {

    options.connected = ICWS.csrfToken ? true: false;
  }

  // Create the base URI, using the ICWS port, with the specified server and session ID.
  var uri = ICWS.URI_PATH;
  if (options.connected) {
    uri += '/' + ICWS.sessionId;
  }
  if (requestPath.substring(0, 1) !== '/') {
    uri += '/';
  }
  uri += requestPath;

  // Adding custom template string
  if (options.template) {
    for (var i = 0; i < options.template.length; i++) {
      var templateItem = options.template[i];
      uri += '/' + templateItem;
    }
  }

  console.log('ICWS.query connected:', options.connected);
  console.log('ICWS.query method:', method);
  console.log('ICWS.query uri:', uri);
  console.log('ICWS.query options:', options);

  // Adding custom query strings
  if (options.query) {
    var queryItem = options.query[0];
    uri += '?' + Object.keys(queryItem)[0] + '=' + queryItem[Object.keys(queryItem)[0]]; // Object.keys(queryItem)[0]  \n=> name of the property
    for (var i = 1; i < options.query.length; i++) {
      var queryItem = options.query[i];
      uri += '&' + Object.keys(queryItem)[0] + '=' + queryItem[Object.keys(queryItem)[0]];
      }
  }

  // Allow JSON to be provided as an option, then convert it to a string.
  var payload = options ? options.payload : null;
  if (typeof payload !== 'string' && !(payload instanceof String)) {
    payload = JSON.stringify(payload);
  }

  console.log('Server:', ICWS.URI_SERVER + ':' + ICWS.URI_PORT); // Use string concatenation for display purposes (does not add a space between strings)

  var httpOptions = {
    host:  ICWS.URI_SERVER,
    port: ICWS.URI_PORT,
    path: uri,
    method: method,
    withCredentials: false,
    headers: {}
  };

  if(payload) {
    httpOptions.headers['Content-Type'] = ICWS.MEDIA_TYPE + ';' + ICWS.MEDIA_CHARSET;
    httpOptions.headers['Content-Length'] = payload.length;
  }

  // If the ICWS request is for an existing session, then the session's CSRF token must be set as
  // a header parameter. This is not provided when establishing the initial connection.
  console.log('ICWS.query / options: ', options);

  if (options.connected) {
    httpOptions.headers['ININ-ICWS-CSRF-Token'] = ICWS.csrfToken;
    httpOptions.headers['ININ-ICWS-Session-ID'] = ICWS.sessionId;
    httpOptions.headers['Cookie'] = ICWS.cookie;
  }
  else {
    httpOptions.headers['Accept-Language'] = 'en';
  }

  // Adding custom header if needed
  if (options.header) {
      for (var i = 0; i < options.header.length; i++) {
          var customHeader = options.header[i];
          httpOptions.headers[customHeader.name] = customHeader.value;
      }
  }

  console.log('httpOptions:', httpOptions);

  // Use HTTPS?
  if (ICWS.URI_SCHEME.indexOf('https') > -1) {
    console.log('Using HTTPS');
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0"; // Allow self-signed certificates
    var req = https.request(httpOptions, function(res) {
      var data = "";
      res.setEncoding('utf8');
      res.on('data', function (chunk) {
        console.log('ICWS.query / res.on:', chunk);
        data += chunk;
      });
      res.on('end', function () {
        if (!ICWS.sessionId || !options.connected) {
          var responseText = JSON.parse(data);
          ICWS.sessionId = responseText.sessionId;
          ICWS.csrfToken = responseText.csrfToken;
          ICWS.cookie = res.headers['set-cookie'];
        }
        ICWS.sendRequestCompleted(res, data, callback);
      });
    });
  } else {
    var req = http.request(httpOptions, function(res) {
      var data = "";
      res.setEncoding('utf8');
      res.on('data', function (chunk) {
        console.log('ICWS.query / res.on:', chunk);
        data += chunk;
      });
      res.on('end', function () {
        if (!ICWS.sessionId || !options.connected) {
          var responseText = JSON.parse(data);
          ICWS.sessionId = responseText.sessionId;
          ICWS.csrfToken = responseText.csrfToken;
          ICWS.cookie = res.headers['set-cookie'];
        }
        ICWS.sendRequestCompleted(res, data, callback);
      });
    });
  }

  req.on('error', function(e) {
    var statusCode = 0;
    console.error('Request error:', e.message);
    if (e.message.indexOf('ECONNREFUSED') > -1) {
      statusCode = 599;
    } else if (e.message.indexOf('socket hang up') > -1) {
      statusCode = 600;
    } else if (e.message.indexOf('ENOTFOUND') > -1) {
      statusCode = 404;
    }
    if (callback) {
      callback(statusCode, e.message);
    }
  });

  // write data to request body
  console.log('ICWS.query / payload:', payload);
  if(payload)
    req.write(payload);
  req.end();
}

ICWS.sync = function (method, object, options, success, error) {
  console.log("\n=> ICWS.sync: ", method, object, options);

  var syncCallback = function (status, response) {
    console.log("\n=> ICWS.sync/syncCallback: ",status, response);
    if (status) {
      if(success && !response.errorId)
        success(response);
      else{
        if(error)
          error(status, response);
      }
      //success(method != 'read' ? object : response);
    }
    else {
      if(error)
        error(status, response);
    }
  };

  var requestOptions = { };

  // if the object has attribute called requestOptions: use these options
  if (options.icwsOptions){
    requestOptions = options.icwsOptions;
    requestOptions.connected = true;
  } else {
    requestOptions.query = [{ select: '*' }];
    requestOptions.connected = true;
  }

  console.log("ICWS.sync / requestOptions: ", requestOptions);
  switch (method) {
    case 'create':
      requestOptions.payload = object.representation;
      ICWS.query('POST', object.url, requestOptions, syncCallback);
      break;
    case 'read':
      if (object.id) // It's a single object \n=> we want the object id in the request template
        requestOptions.template = [object.id];
      ICWS.query('GET', object.url, requestOptions, syncCallback);
      break;
    case 'update':
      requestOptions.payload = object.representation;
      ICWS.query('PUT', object.url, requestOptions, syncCallback);
      break;
    case 'delete':
      requestOptions.payload = object.representation;
      ICWS.query('DELETE', object.url, requestOptions, syncCallback);
      break;
  }
}

ICWS.sendRequestCompleted = function (res, chunk, callback) {

    var status, responseText, response;

    status = res.statusCode;
    console.log('status:', status);
    console.log('chunk:', chunk);
    console.log('headers:', res.headers);

    // Handle 401 failures as server disconnects.
    if (status === 401) {
    }

    // Process the response body.
    responseText = chunk;
    if (responseText) {
        try {
            response = JSON.parse(responseText);
        } catch (e) {
            /* If the JSON cannot be parsed, use an empty object for response. */
            response = {};
        }
    } else {
        response = {};
    }

    // Signal the request result to the caller's callback.
    callback(status, response);
}

module.exports.login = ICWS.login = function (username, password, callback) {

  // Validate parameters
  if (!username) {
    console.error('Missing username');
    throw new Error('Missing username');
  }

  if (!password) {
    console.error('Missing password');
    throw new Error('Missing password');
  }

  // GO!
  console.log('Connecting to CIC');
  var loginRequestOptions = {
    connected: false,
    payload: {
      "__type": "urn:inin.com:connection:icAuthConnectionRequestSettings",
      "applicationName": ICWS.applicationName,
      "userID": username,
      "password": password
    }
  }

  ICWS.query('POST', ICWS.URL.Connection, loginRequestOptions, function (statusCode, response) {
    console.log('Login: Status Code:', statusCode);
    console.log('Login: Response:', response);

    switch (statusCode) {
      case 400: // Bad Request
        console.error('Bad request. Please check your credentials and server name.', response);
        if (callback) {
          callback(400, 'Bad request');
        }
        break;
      case 401: // Authentication Failure
        console.error('Authentication Failure. Please check your credentials and server name.', response);
        if (callback) {
          callback(401, 'Authentication Failure');
        }
        break;
      case 404: // Not found
        console.error('Not found. Please check your server name.', response);
        if (callback) {
          callback(404, 'Not Found');
        }
        break;
      case 410: // Gone
        console.error('Resource is gone. Please check your credentials and server name.', response);
        if (callback) {
          callback(410, 'Resource is gone');
        }
        break;
      case 500: // Internal Server Error
        console.error('Internal Server Error. Please check your credentials and server name.', response);
        if (callback) {
          callback(500, 'Internal Server Error');
        }
        break;
      case 503: // Service unavailable
        if (!gotBackup(response)) {
          // No switchover
          console.error('Connection Error: 503. No other servers found.');
          if (callback) {
            callback(503, 'No other servers found');
          }
        }
        else {
          if (response.hasOwnProperty('alternateHostList')) {
            console.warn('Connection failed. Trying alternate hosts');
            //TODO To test and improve
            // Connect to the alternate hosts in the order they are listed
            // for(alternateHost of response.alternateHostList) {
            //   ICWS.URI_SERVER = alternateHost;
            //   login(userID, password, function(alternateResponse) {
            //     if (gotBackup(alternateResponse)) {
            //       return; // Try next server
            //     }
            //     else {
            //     }
            //   });
            // }
          }
          else {
            // No alternate hosts
            console.error('Connection Error: 503. No other servers found.');
            if (callback) {
              callback(503, 'No other servers found');
            }
          }
        }
        break;
        case 599: // Network Connect Timeout Error
          console.error('Network Connect Timeout Error. Please check your server name. %s', response);
          if (callback) {
            callback(599, 'Network Connect Timeout Error');
          }
          break;
          case 600: // Socket Hang Up
            console.error('Socket Hang Up. Not sure why.');
            if (callback) {
              callback(600, 'Socket Hang Up');
            }
            break;
      case 201:
        console.log('Connected');
        if (callback)
          callback(0, response);
        break;
      default:
        console.error('Unknown error code:', statusCode);
    }
  });
}

module.exports.logout = ICWS.logout = function(callback) {
  ICWS.query('DELETE', ICWS.URL.Connection, {}, function (status, response) {
    console.log('Logout: Status:', status);
    console.log('Logout: Response:', response);

    if (callback) {
      callback(status, response);
    }
  });
}

module.exports.fetch = ICWS.fetch = function(options) {
  var success = options.success;
  var error = options.error;
  ICWS.sync('read', options, options, success, error);
}

module.exports.update = ICWS.update = function(options) {
  var success = options.success;
  var error = options.error;
  ICWS.sync('update', options, options, success, error);
}

module.exports.post = ICWS.post = function(options) {
  var success = options.success;
  var error = options.error;
  ICWS.sync('create', options, options, success, error);
}

module.exports.delete = ICWS.delete = function(options) {
  var success = options.success;
  var error = options.error;
  ICWS.sync('delete', options, options, success, error);
}

/***** Inflate an object
*   Inflate any object :
*       - refObject: The referece to the object you want to inflate.
*           It MUST contain "id" and "uri" properties
*       - fetch: true if you want to fetch the object immediately
*       - success: callback when object has been inflated
*       - Returns: the inflated object.
*********************************************/
module.exports.inflate = ICWS.inflate = function (refObject, fetch, success) {
    var url = refObject.url;
    var id = refObject.id;
    var collectionAnchor = refObject.collectionAnchor;

    if(!fetch){ // If no fatch defined, no automatic fetch !
      fetch = false;
    }

    // Inflate a new Model
    if (id) {
        // If "url" is not defined, parse "uri"
        if (!url) {
            url = refObject.uri.substring(0, refObject.uri.length - id.length - 1)
        }

        // Creates a new object from
        return new ICWS.BaseObject({
            id: id,
            url: url,
            fetch: fetch,
            success: success
        });
    }
    else { // Inflate a new Collection
        return new ICWS.BaseCollection({
            url: url,
            fetch: fetch,
            collectionAnchor: collectionAnchor,
            success: success
        });
    }
}

module.exports.BaseObject = ICWS.BaseObject = function BaseObject(options) {
  var self = this;

  this.sync = function(method, options, success, error){
    console.log("\n=> ICWS.BaseObject.sync: ", method, options);
    return ICWS.sync(method, this, options, success, error);
  }

  this.fetch = function(options){
    return ICWS.sync('read', this, options, options.success, options.error);
  }

  this.initialize = function(options){
    self.id = -1;
    if(options.id) // No id when creating a new object
      self.id = options.id;
    self.url = options.url;

    self.attributes = {};
    if(options.attributes)
      self.attributes = options.attributes;

    if (options.sync) {
      if(self.id != -1){ // fetch the object
        ICWS.sync('read', this, {icwsOptions: { query: [{ select: '*' }]}},
          options.success, options.error);
      }
      else{ // Creates the object using attributes
        ICWS.sync('create', this, {}, options.success, options.error );
      }
    }
  }

  this.on = function(messageType, icwsOptions, fn){
    ICWS.MessageManager.on(messageType, self, icwsOptions, function(res){
      fn(res);
    })
  }

  this.off = function(messageType, fn){
    ICWS.MessageManager.off(messageType, self, function(res){
      fn(res);
    })
  }

  this.initialize(options);
}

module.exports.BaseCollection = ICWS.BaseCollection = function BaseCollection(options) {
  var self = this;

  this.sync = function(method, options, success, error){
    console.log("\n=> ICWS.BaseCollection.sync: ", method, options);
    return ICWS.sync(method, this, options, success, error);
  }

  this.fetch = function(options){
    return ICWS.sync('read', this, options, options.success, options.error);
  }

  this.initialize = function(options){
    self.url = options.url;

    self.attributes = {};
    if(options.attributes)
      self.attributes = options.attributes;

    if (options.sync) {
        ICWS.sync('read', this, {icwsOptions: { query: [{ select: '*' }]}},
          options.success, options.error);
    }
  }

  this.initialize(options);
}

module.exports.MessageManager =  ICWS.MessageManager = new function(){
  var self = this;
  this.pullInterval;
  this.listeners = [];

  this.start = function(timeout){
    self.listeners = [];
    if(!timeout)
      timeout = ICWS.PULL_MESSAGES_TIMEOUT;
    self.pullInterval = setInterval(pullMessages, timeout);
  }

  this.stop = function(){
    self.listeners = [];
    clearInterval(self.pullInterval);
  }

  this.addListener = function(messageType, fn ){
    console.log("addListener", messageType);
    if(!self.listeners[messageType]){
      self.listeners[messageType] = [];
    }
    if(fn instanceof Function){
      self.listeners[messageType].push(fn);
    }
  }

  this.dispatchMessage = function(message){
    //console.log(message);
    var l = self.listeners[message.__type].length;
    for(var i = 0; i<l ; i++ ){
      self.listeners[message.__type][i].call(this, message);
    }
  }

  this.removeListener = function(messageType, fn){
    if(self.listeners[messageType]){
      var l = self.listeners[messageType].length;
      for(var i = 0; i<l ; i++ ){
        if(self.listeners[messageType][i] == fn){
          self.listeners[messageType].splice(i, 1);
          break;
        }
      }
    }
  }

  var pullMessages = function(){
    console.log("\n=>EventManager.pullMessages");
    var messages = new ICWS.BaseCollection({
      url: ICWS.URL.Messages,
      sync: true,
      representation: {},
      success: function(messages){
        console.log("EventManager.pullMessages", messages);
        var messageCount = messages.length;
        for (var i = 0; i < messageCount; i++) {
          if(messages[i].isDelta)
            self.dispatchMessage(messages[i]);
        }
      },
      error: function(error){}
    });
  }

  this.subscribe = this.on = function(options){
    var url = options.url;
    var messageType = options.messageType;
    var messageTypes = options.messageTypes;
    var representation = options.representation;
    var icwsOptions = options.icwsOptions;
    var fn = options.handleEvent;
    console.log("\n=> ICWS.on: ", url, messageType, messageTypes, representation, icwsOptions);

    ICWS.update({
        url: url,
        icwsOptions: icwsOptions,
        representation: representation,
        success: function(data){
          console.log("\n=> subscribe/success ");
          if(messageTypes){
            for(var i=0; i<messageTypes.length; i++){
              self.addListener(messageTypes[i], fn);
            }
          }
          if(messageType)
            self.addListener(messageType, fn);
        },
        error: function(data){
          console.log("\n=> subscribe/error ", data);
        }
      });
  }

  this.unsubscribe = this.off = function(options){
    var url = options.url;
    var messageType = options.messageType;
    var messageTypes = options.messageTypes;
    var fn = options.handleEvent;
    ICWS.delete({
      url: url,
      icwsOptions: {},
      success: function(){
        if(messageTypes){
          for(var i=0; i<messageTypes.length; i++){
            self.removeListener(messageTypes[i], fn);
          }
        }
        if(messageType)
          self.removeListener(messageType, fn);
      }
    })
  }
}

var gotBackup = function(response) {
  if (response.errorId == 'error.server.notAcceptingConnections') {
    true;
  }
}
