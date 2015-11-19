'use strict';

var querystring = require('querystring');
var http = require('http');

DEBUG = false;
INFO = false;

var ICWS = {
    applicationName: "ICWS Example Application",
    URI_SCHEME: 'http://',
    URI_SERVER: 'localhost', // IC Server IP
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

/*** Initialize variables ***/
module.exports.start = function(options) {
  if(DEBUG) console.log('Starting', options);
  if (options.applicationName) {
    ICWS.applicationName = options.applicationName;
  }

  if (options.icServerHostname) {
    ICWS.URI_SERVER = options.icServerHostname;
  }

  if (options.icServerPort) {
    ICWS.URI_PORT = options.icServerPort;
  }

  if (options.i3DirectoryUsers) {
    ICWS.i3Directory.users = options.i3DirectoryUsers;
  }

  if (options.username && options.password) {
    if(options.loginSuccess) {
      ICWS.login(options.username, options.password, options.loginSuccess);
    } else {
      ICWS.login(options.username, options.password, function(){});
    }
  }
}

ICWS.query = function (method, requestPath, options, resultCallback) {
  if(DEBUG) console.log("\n=> ICWS.query: ", method, requestPath, options);

  var uri;
  var payload = options.payload;

  if (options.connected == undefined) {
    options.connected = true;
  }

  // Create the base URI, using the ICWS port, with the specified server and session ID.
  uri = ICWS.URI_PATH;

  // Once a session has been established, subsequent requests for that session require its session ID.
  // (This is not provided when establishing the initial connection.)
  if (options.connected) {
    uri += '/' + ICWS.sessionId;
  }

  // Add the specific ICWS request to the URI being built.
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

  if(DEBUG){
    console.log("ICWS.query method:", method);
    console.log("ICWS.query uri:", uri);
    console.log("ICWS.query options:", options);
  }

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
  if (typeof payload !== 'string' && !(payload instanceof String)) {
      payload = JSON.stringify(payload);
  }

  if (INFO) console.log('Server:', ICWS.URI_SERVER + ':' + ICWS.URI_PORT);

  var httpOptions = {
    host:  ICWS.URI_SERVER,
    port: ICWS.URI_PORT,
    path: uri,
    method: method,
    withCredentials: false,
    headers: {}
  };

  if(payload){
    httpOptions.headers['Content-Type'] = ICWS.MEDIA_TYPE + ';' + ICWS.MEDIA_CHARSET;
    httpOptions.headers['Content-Length'] = payload.length;
  }

  // If the ICWS request is for an existing session, then the session's CSRF token must be set as
  // a header parameter.
  // (This is not provided when establishing the initial connection.)
  if(DEBUG) console.log('ICWS.query / options: ', options);

  if (options.connected){
    httpOptions.headers['ININ-ICWS-CSRF-Token'] = ICWS.csrfToken;
    httpOptions.headers['ININ-ICWS-Session-ID'] = ICWS.sessionId;
    httpOptions.headers['Cookie'] = ICWS.cookie;
  }
  else{
    httpOptions.headers['Accept-Language'] = 'en';
  }

  // Adding custom header if needed
  if (options.header) {
      for (var i = 0; i < options.header.length; i++) {
          var customHeader = options.header[i];
          httpOptions.headers[customHeader.name] = customHeader.value;
      }
  }

  if(DEBUG) console.log('httpOptions:', httpOptions);

  var req = http.request(httpOptions, function(res) {
    var data = "";
    res.setEncoding('utf8');
    res.on('data', function (chunk) {
        if(DEBUG) console.log("\n=> ICWS.query / res.on", chunk);
        data += chunk;
    });
    res.on('end', function () {
      if (!ICWS.sessionId || !options.connected) {
          var responseText = JSON.parse(data);
          ICWS.sessionId = responseText.sessionId;
          ICWS.csrfToken = responseText.csrfToken;
          ICWS.cookie = res.headers['set-cookie'];
      }
      ICWS.sendRequestCompleted(res, data, resultCallback);
    });
  });

  req.on('error', function(e) {
    console.log('problem with request: ' + e.message);
  });

  // write data to request body
  if(DEBUG) console.log("ICWS.query / payload: ", payload);
  if(payload)
    req.write(payload);
  req.end();
}

ICWS.sendRequestCompleted = function (res, chunk, resultCallback) {

    var status, responseText, response;

    status = res.statusCode;
    if(DEBUG) console.log("status", status);
    if(DEBUG) console.log("chunk", chunk);
    if(DEBUG) console.log("headers", res.headers);

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
    resultCallback(status, response);
}

/*** Login as User ***/
module.exports.login = ICWS.login = function (userID, password, callback) {
  if(DEBUG) console.log('logging in to CIC');
  var loginRequestOptions = {
    connected: false,
    payload: {
      "__type": "urn:inin.com:connection:icAuthConnectionRequestSettings",
      "applicationName": ICWS.applicationName,
      "userID": userID,
      "password": password
    }
  }

  ICWS.query('POST', ICWS.URL.Connection, loginRequestOptions, function (status, response) {
    if(DEBUG) console.log('Login: Status:', status);
    if(DEBUG) console.log('Login: Response:', response);

    // Tried to connect to a backup server?
    // TODO Test this
    /*
    if (gotBackup(response)) {
      if (response.hasOwnProperty('alternateHostList')) {
        // Connect to the alternate hosts in the order they are listed
        for(alternateHost of response.alternateHostList) {
          ICWS.URI_SERVER = alternateHost;
          login(userID, password, function(alternateResponse) {
            if (gotBackup(alternateResponse)) {
              continue; // Try next server
            }
            else {
              // Call the original callback function
              if (callback) {
                callback();
              }
            }
          });
        }
        return;
      } else {
        // No switchover
        console.error('Server is not accepting request. No alternate hosts specified.');
      }
    }*/
    if (callback)
      callback(response);
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

var gotBackup = function(response) {
  if (response.errorId == 'error.server.notAcceptingConnections') {
    true;
  }
}

// Logout from CIC
module.exports.logout = ICWS.logout = function(callback) {
  ICWS.query('DELETE', ICWS.URL.Connection, undefined, function (status, response) {
    if(DEBUG) console.log('Logout: Status:', status);
    if(DEBUG) console.log('Logout: Response:', response);

    if (callback) {
      callback();
    }
  });
}

/***** Inflate an object
*   Inflate any object :
*       - refObject: The referece to the object you want to inflate.
*           It MUST contains "id" and "uri" properties
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

/***** Sync for ICWS
*   CRUD for ICWS objects.
*********************************************/
ICWS.sync = function (method, object, options, success, error) {
  if(DEBUG) console.log("\n=> ICWS.sync: ", method, object, options);

  var syncCallback = function (status, response) {
    //if(DEBUG) console.log("\n=> ICWS.sync/syncCallback: ",status, response);
    if (status) {
      if(success && !response.errorId)
        success(response);
      else{
        if(error)
          error(response);
      }
      //success(method != 'read' ? object : response);
    }
    else {
      if(error)
        error(response);
    }
  };

  var requestOptions = { };

  // if the object has attribute called requestOptions: use these options
  if (options && options.icwsOptions){
    requestOptions = options.icwsOptions;
    requestOptions.connected = true;
  } else {
    requestOptions.query = [{ select: '*' }];
    requestOptions.connected = true;
  }

  if (INFO) console.log("ICWS.sync / requestOptions: ", requestOptions);
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

module.exports.BaseObject = ICWS.BaseObject = function BaseObject(options) {
  var self = this;

  this.sync = function(method, options, success, error){
    if(DEBUG) console.log("\n=> ICWS.BaseObject.sync: ", method, options);
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
    if(DEBUG) console.log("\n=> ICWS.BaseCollection.sync: ", method, options);
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

module.exports.MessageManager =  ICWS.MessageManager = new function() {
  var self = this;
  this.listeners = [];

  this.start = function(timeout){
    self.listeners = [];
    if(!timeout)
      timeout = ICWS.PULL_MESSAGES_TIMEOUT;
    setInterval(pullMessages, timeout);
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
    console.log(message);
    l = self.listeners[message.__type].length;
    for(var i = 0; i<l ; i++ ){
      self.listeners[message.__type][i].call(this, message);
    }
  }

  this.removeListener = function(messageType, fn){
    if(self.listeners[messageType]){
      l = self.listeners[messageType].length;
      for(var i = 0; i<l ; i++ ){
        if(self.listeners[messageType][i] == fn){
          self.listeners[messageType].slice(i, 1);
          break;
        }
      }
    }
  }

  var pullMessages = function(){
    if(INFO) console.log("\n=>EventManager.pullMessages");
    var messages = new ICWS.BaseCollection({
      url: ICWS.URL.Messages,
      sync: true,
      attributes: {},
      success: function(messages){
        if(INFO) console.log("EventManager.pullMessages", messages);
        var messageCount = messages.length;
        for (i = 0; i < messageCount; i++) {
          if(messages[i].isDelta)
            self.dispatchMessage(messages[i]);
        }
      },
      error: function(error){}
    });

  }

  this.subscribe = this.on = function(messageType, subscription, icwsOptions, fn){
    if(DEBUG) console.log("\n=> ICWS.on: ", messageType, subscription, icwsOptions);

    subscription.sync('update', {icwsOptions: icwsOptions}, function(){
        // On success
        console.log("\n=> subscribe/success ");
        self.addListener(messageType, fn);
      },
      function(){
        // On error
        console.log("\n=> subscribe/error ", response);
      });
  }

  this.unsubscribe = this.off = function(messageType, subscription, fn){
    subscription.sync('delete', {icwsOptions: {}}, function(response){
        console.log("\n=> unsubscribe/success ");
        // On success
        self.removeListener(messageType, fn);
      },
      function(){
        // On error
      });
  }
}
