import { createServer, type Server } from "http";
import { createRequestHandler, type ISqsServerOptions } from "./parsers/requestHandler";

export const createSqsServer = (options: ISqsServerOptions): Promise<Server> => {
  return new Promise((resolve) => {
    const { requestHandler, service } = createRequestHandler(options);
    const server = createServer(requestHandler);

    const resolver = async () => {
      const address = server.address();

      if (address && typeof address == "object") {
        service.PORT = address.port;
      }

      resolve(server);
    };

    const listenArgs: any[] = [options.port];

    if (options.hostname) {
      listenArgs.push(options.hostname);
    }
    listenArgs.push(resolver);

    server.listen(...listenArgs);
  });
};

export { createRequestHandler };
export { type ISqsServerOptions };
