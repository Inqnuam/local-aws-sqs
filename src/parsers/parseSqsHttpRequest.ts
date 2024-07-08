import { randomUUID } from "crypto";
import type { IncomingMessage } from "http";
import { AWS_ACTION_TYPE, AWS_JSON_TYPE, AWS_TRACE_ID } from "../common/constants";
import { Queue } from "../lib/queue";
import { decode } from "aws-query-decoder";

const parseQueueUrl = (reqQueueUrl?: string) => {
  if (!reqQueueUrl) {
    return;
  }

  let QueueUrl = reqQueueUrl;
  try {
    const url = new URL(reqQueueUrl);
    const paths = url.pathname.split("/").filter(Boolean);
    QueueUrl = paths[paths.length - 1];
  } catch (error) {}

  return QueueUrl;
};

export const parseSqsHttpRequest = async (req: IncomingMessage) => {
  let data: Buffer;
  const RequestId = randomUUID();
  const isJsonProtocol = req.headers["content-type"] == AWS_JSON_TYPE;
  const traceId = req.headers[AWS_TRACE_ID] as string | undefined;

  let body: Record<string, any> = {};
  let Action: string | undefined = undefined;
  let QueueUrl: string | undefined = undefined;

  req.on("data", (chunk) => {
    data = typeof data == "undefined" ? chunk : Buffer.concat([data, chunk]);
  });

  const rawBody: string = await new Promise((resolve) => {
    req.on("end", async () => {
      resolve(data?.toString());
    });
  });

  if (isJsonProtocol) {
    Action = (req.headers[AWS_ACTION_TYPE] as string).split(".")[1];

    try {
      body = JSON.parse(rawBody);
    } catch (error) {}
  } else if (rawBody) {
    body = decode(rawBody);

    Action = body.Action;
  }

  QueueUrl = parseQueueUrl(body.QueueUrl);
  const foundQueue = Queue.Queues.find((x) => x.QueueName == QueueUrl);

  return {
    isJsonProtocol,
    RequestId,
    traceId,
    body,
    Action,
    foundQueue,
    QueueUrl,
  };
};
