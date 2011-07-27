const path = require('path')
    , express = require('express')
    , app = module.exports = express.createServer()
    , port = process.env.PORT || 1337
    ;
 
/** Configuration */
app.configure(function() {
  this.set('views', path.join(__dirname, 'views'));
  this.set('view engine', 'ejs');
  this.use(express.static(path.join(__dirname, '/public')));
  // Allow parsing cookies from request headers
  this.use(express.cookieParser());
  // Session management
  this.use(express.session({
    // Private crypting key
    "secret": "some private string",
    // Internal session data storage engine, this is the default engine embedded with connect.
    // Much more can be found as external modules (Redis, Mongo, Mysql, file...). look at "npm search connect session store"
    "store":  new express.session.MemoryStore({ reapInterval: 60000 * 10 })
  }));
});
app.configure('development', function(){
  this.use(express.errorHandler({ dumpExceptions: true, showStack: true }));
});
app.configure('production', function(){
  this.use(express.errorHandler());
});
 
/** Routes */
app.get('/', function (req, res, next) {
  res.render('index');
});
app.get('/session-index', function (req, res, next) {
  // Increment "index" in session
  req.session.index = (req.session.index || 0) + 1;
  // View "session-index.ejs"
  res.render('session-index', {
    "index":  req.session.index,
    "sessId": req.sessionID
  });
});

/** Start server */
if (!module.parent) {
  app.listen(port)
}
