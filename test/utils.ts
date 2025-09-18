import { createSqsServer } from "../src/";
import { SQSClient } from "@aws-sdk/client-sqs";
import { AddressInfo } from "net";
import child_process from "child_process";

export async function createServerAndCli() {
  const server = await createSqsServer({ port: 0 });

  const PORT = (server.address() as AddressInfo).port;

  const client = new SQSClient({
    region: "us-east-1",
    endpoint: `http://localhost:${PORT}`,
    credentials: {
      accessKeyId: "fake",
      secretAccessKey: "fake",
    },
  });

  const cli = (cmd: string) => {
    return new Promise((resolve: Function, reject: Function) => {
      child_process.exec(`AWS_ACCESS_KEY_ID=fake AWS_SECRET_ACCESS_KEY=fake aws --region us-east-1 --endpoint http://localhost:${PORT} sqs ${cmd}`, (err, stdout, stderr) => {
        if (err) {
          reject(err);
          return;
        }
        if (stderr) {
          reject(stderr);
          return;
        }
        resolve(stdout);
      });
    });
  };

  return {
    server,
    client,
    cli,
    PORT,
  };
}
