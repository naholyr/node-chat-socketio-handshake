const path = require('path')
    , express = require('express')
    , connect = require('express/node_modules/connect')
    , cookie = require('express/node_modules/cookie')
    , app = express()
    , http = require('http')
    , server = http.createServer(app)
    , port = process.env.PORT || 1337
    , sessionStore = new express.session.MemoryStore({ reapInterval: 60000 * 10 })
    , sessionSecret = "some private string"
    ;

// Public API: distinct app (Express) and actual server (HttpServer)
module.exports = { app: app, server: server };

/** Configuration */
app.configure(function() {
  this.engine('ejs', require('ejs-locals'));
  this.set('views', path.join(__dirname, 'views'));
  this.set('view engine', 'ejs');
  this.use(express.static(path.join(__dirname, '/public')));
  // Allow parsing cookies from request headers
  this.use(express.cookieParser());
  // Session management
  // Internal session data storage engine, this is the default engine embedded with connect.
  // Much more can be found as external modules (Redis, Mongo, Mysql, file...). look at "npm search connect session store"
  this.use(express.session({ "secret": sessionSecret, "store": sessionStore }));
  // Allow parsing form data
  this.use(express.bodyParser());
});
app.configure('development', function(){
  this.use(express.errorHandler({ dumpExceptions: true, showStack: true }));
});
app.configure('production', function(){
  this.use(express.errorHandler());
});

/** Routes */
app.get('/session-index', function (req, res, next) {
  // Increment "index" in session
  req.session.index = (req.session.index || 0) + 1;
  // View "session-index.ejs"
  res.render('session-index', {
    "index":  req.session.index,
    "sessId": req.sessionID
  });
});

/** Middleware for limited access */
function requireLogin (req, res, next) {
  if (req.session.username) {
    // User is authenticated, let him in
    next();
  } else {
    // Otherwise, we redirect him to login form
    res.redirect("/login");
  }
}

/** Home page (requires authentication) */
app.get('/', [requireLogin], function (req, res, next) {
  res.render('index', { "username": req.session.username });
});

/** Login form */
app.get("/login", function (req, res) {
  // Show form, default value = current username
  res.render("login", { "username": req.session.username, "error": null });
});
app.post("/login", function (req, res) {
  var options = { "username": req.body.username, "error": null };
  if (!req.body.username) {
    options.error = "User name is required";
    res.render("login", options);
  } else if (req.body.username == req.session.username) {
    // User has not changed username, accept it as-is
    res.redirect("/");
  } else if (!req.body.username.match(/^[a-zA-Z0-9\-_]{3,}$/)) {
    options.error = "User name must have at least 3 alphanumeric characters";
    res.render("login", options);
  } else {
    // Validate if username is free
    sessionStore.all(function (err, sessions) {
      if (!err) {
        var found = false;
        for (var i=0; i<sessions.length; i++) {
          var session = JSON.parse(sessions[i]);
          if (session.username == req.body.username) {
            err = "User name already used by someone else";
            found = true;
            break;
          }
        }
      }
      if (err) {
        options.error = ""+err;
        res.render("login", options);
      } else {
        req.session.username = req.body.username;
        res.redirect("/");
      }
    });
  }
});

/** WebSocket */
var sockets = require('socket.io').listen(server).of('/chat');
sockets.authorization(function (handshakeData, callback) {
  // Read cookies from handshake headers
  var cookies = cookie.parse(handshakeData.headers.cookie);
  // We're now able to retrieve session ID
  var sessionID;
  if (cookies['connect.sid']) {
    sessionID = connect.utils.parseSignedCookie(cookies['connect.sid'], sessionSecret);
  }
  // No session? Refuse connection
  if (!sessionID) {
    callback('No session', false);
  } else {
    // Store session ID in handshake data, we'll use it later to associate
    // session with open sockets
    handshakeData.sessionID = sessionID;
    // On récupère la session utilisateur, et on en extrait son username
    sessionStore.get(sessionID, function (err, session) {
      if (!err && session && session.username) {
        // On stocke ce username dans les données de l'authentification, pour réutilisation directe plus tard
        handshakeData.username = session.username;
        // OK, on accepte la connexion
        callback(null, true);
      } else {
        // Session incomplète, ou non trouvée
        callback(err || 'User not authenticated', false);
      }
    });
  }
});
// Active sockets by session
var connections = {};
sockets.on('connection', function (socket) { // New client
  var sessionID = socket.handshake.sessionID; // Store session ID from handshake
  // this is required if we want to access this data when user leaves, as handshake is
  // not available in "disconnect" event.
  var username = socket.handshake.username; // Same here, to allow event "bye" with username
  if ('undefined' == typeof connections[sessionID]) {
    connections[sessionID] = { "length": 0 };
    // First connection
    sockets.emit('join', username, Date.now());
  }
  // Add connection to pool
  connections[sessionID][socket.id] = socket;
  connections[sessionID].length ++;
  // When user leaves
  socket.on('disconnect', function () {
    // Is this socket associated to user session ?
    var userConnections = connections[sessionID];
    if (userConnections.length && userConnections[socket.id]) {
      // Forget this socket
      userConnections.length --;
      delete userConnections[socket.id];
    }
    if (userConnections.length == 0) {
      // No more active sockets for this user: say bye
      sockets.emit('bye', username, Date.now());
    }
  });
  // New message from client = "write" event
  socket.on('write', function (message) {
    sockets.emit('message', username, message, Date.now());
  });
});

/** Start server */
if (!module.parent) {
  server.listen(port, function () {
    console.log('Listening', this.address());
  })
}
