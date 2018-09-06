/**
 * @file 代理请求转发到本地文件系统
 * @author zdying
 */

'use strict';

var fs = require('fs');
var path = require('path');

var getMimeType = require('simple-mime')('application/octet-stream');
// var execDirectives = require('../../../directives').execDirectives;

module.exports = {
  response: function (ctx, request, response, next) {
    var hiproxy = this;
    var proxyInfo = ctx.proxy;
    // var rewriteRule = proxyInfo.rewriteRule;

    log.debug(request.url + ' ==> ' + proxyInfo.url);

    response.headers = response.headers || {};

    // 执行response作用域的command
    // execDirectives(rewriteRule, {
    //   res: response
    // }, 'response');

    /**
     * Emitted each time the server set response info (eg: headers).
     * @event ProxyServer#setResponse
     * @property {http.ServerResponse} response request object
     */
    hiproxy.emit('setResponse', response);

    try {
      var stats = fs.statSync(proxyInfo.url);
      var filePath = proxyInfo.url;
      var rewrite = proxyInfo.rewriteRule;

      if (stats.isDirectory()) {
        log.debug('isDirectory and add root:' + (rewrite.variables.$default || 'index.html'));
        filePath = path.join(filePath, rewrite.variables.$default || 'index.html');
      }

      // TODO 如果没有root，列出目录
      var stream = fs.createReadStream(filePath);
      response.setHeader('Content-Type', getMimeType(filePath));

      stream.on('error', /* istanbul ignore next */ function (e) {
        response.statusCode = 500;
        response.end('500 Server Internal Error: <br><pre>' + e.stack + '</pre>');

        next();
      });

      // stream.on('data', function (chunk) {
      //   /**
      //    * Emitted whenever the response stream received some chunk of data.
      //    * @event ProxyServer#data
      //    * @property {Buffer} data response data
      //    */
      //   hiproxy.emit('data', chunk, request, response);
      // });

      stream.on('end', function () {
        // /**
        //  * Emitted when a response is end. This event is emitted only once.
        //  * @event ProxyServer#response
        //  * @property {http.ServerResponse} response response object
        //  */
        // // hiproxy.emit('response', request, response);

        // log.access(request);

        next();
      });

      return stream.pipe(response);
    } catch (err) {
      log.error(err);
      response.setHeader('Content-Type', 'text/html');

      if (err.code === 'ENOENT') {
        response.statusCode = 404;
        response.end('404 Not Found: <br><pre>' + err.stack + '</pre>');
      } else {
        response.statusCode = 500;
        response.end('500 Server Internal Error: <br><pre>' + err.stack + '</pre>');
      }

      // hiproxy.emit('response', response);

      next();
    }
  }
};
