import type { IncomingMessage, ServerResponse } from "http";
import { AWS_JSON_TYPE, AWS_XML_TYPE } from "../common/constants";
import { Queue } from "../lib/queue";
import { SqsError } from "../common/errors";

export abstract class SqsCommand {
  body: any;
  constructor(
    public req: IncomingMessage,
    public res: ServerResponse,
    public isJsonProtocol: boolean,
    public RequestId: string,
    public reqBody: any,
    public foundQueue?: Queue,
    public traceId?: string
  ) {
    this.res.setHeader("x-amzn-requestid", this.RequestId);
    if (this.isJsonProtocol) {
      res.setHeader("Content-Type", AWS_JSON_TYPE);
    } else {
      res.setHeader("Content-Type", AWS_XML_TYPE);
    }
  }

  abstract exec(): Promise<any>;

  verifyExistingQueue() {
    if (!this.reqBody.QueueUrl || !this.foundQueue || Queue.deletingQueues.has(this.foundQueue.QueueName)) {
      throw new SqsError({
        Code: "AWS.SimpleQueueService.NonExistentQueue",
        Type: "com.amazonaws.sqs#QueueDoesNotExist",
        Message: this.isJsonProtocol ? "The specified queue does not exist." : "The specified queue does not exist for this wsdl version.",
      });
    }
  }
}

export interface IFailedRequest {
  Code: string;
  Id: string;
  Message: string;
  SenderFault: true;
}

export interface ISuccessfulRequest {
  Id: string;
}
