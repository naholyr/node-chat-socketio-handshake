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
 
/** Start server */
if (!module.parent) {
  app.listen(port)
}
