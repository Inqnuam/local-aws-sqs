import { createServer, type Server } from "http";
import { createRequestHandler, type ISqsServerOptions } from "./parsers/requestHandler";

export const createSqsServer = (options: ISqsServerOptions): Promise<Server> => {
  return new Promise((resolve) => {
    const server = createServer(createRequestHandler(options));

    const resolver = async () => {
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
