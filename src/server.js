const http = require('http');
const https = require('https');
const Koa = require('koa');
const fp = require('lodash/fp');
const { pathToRegexp } = require('path-to-regexp');
const apiParser = require('@quanxiaoxiao/api-parser');
const routeHandler = require('@quanxiaoxiao/route-handler');

module.exports = ({
  api,
  middlewares = [],
  port = 3000,
  key: certKey,
  cert,
}) => {
  const routeList = apiParser(api)
    .map((item) => ({
      ...item,
      regexp: pathToRegexp(item.pathname),
    }));

  console.log('---------routerList---------');
  console.log(routeList.map((item) => `${item.method} ${item.pathname}`).join('\n'));
  console.log('---------routerList---------');

  const app = new Koa();

  middlewares.forEach((middleware) => {
    app.use(middleware);
  });

  app.use(async (ctx, next) => {
    const routerItem = routeList.find((item) => {
      if (!item.regexp.exec(ctx.path)) {
        return false;
      }
      if (item.method === '*') {
        return true;
      }
      if (item.method === ctx.method) {
        return true;
      }
      return false;
    });
    if (!routerItem) {
      ctx.throw(404);
    }
    const handleName = fp.compose(
      fp.first,
      fp.filter((key) => !['method', 'pathname', 'regexp'].includes(key)),
      fp.keys,
    )(routerItem);
    if (!handleName) {
      console.error(`pathname: ${routerItem.pathname}, cant handle`);
      ctx.throw(500);
    }
    const handler = routeHandler[handleName];
    if (!handler || typeof handler !== 'function') {
      console.error(`pathname: ${routerItem.pathname}, cant handle by ${handleName}`);
      ctx.throw(500);
    }
    ctx.matchs = routerItem.regexp.exec(ctx.path);
    await handler(routerItem[handleName])(ctx, next);
  });


  const server = (cert ? https : http)
    .createServer({
      ...cert
        ? {
          cert,
          key: certKey,
        }
        : {},
    }, app.callback())
    .listen(port, () => {
      console.log(`server listen at port: ${port}`);
    });
  return server;
};
