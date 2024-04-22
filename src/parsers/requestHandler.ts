import type { IncomingMessage, ServerResponse } from "http";
import { parseSqsHttpRequest } from "./parseSqsHttpRequest";
import { ListQueues } from "../actions/ListQueues";
import { AddPermission } from "../actions/AddPermission";
import { CancelMessageMoveTask } from "../actions/CancelMessageMoveTask";
import { ChangeMessageVisibility } from "../actions/ChangeMessageVisibility";
import { ChangeMessageVisibilityBatch } from "../actions/ChangeMessageVisibilityBatch";
import { CreateQueue } from "../actions/CreateQueue";
import { DeleteMessage } from "../actions/DeleteMessage";
import { DeleteMessageBatch } from "../actions/DeleteMessageBatch";
import { DeleteQueue } from "../actions/DeleteQueue";
import { GetQueueAttributes } from "../actions/GetQueueAttributes";
import { GetQueueUrl } from "../actions/GetQueueUrl";
import { ListDeadLetterSourceQueues } from "../actions/ListDeadLetterSourceQueues";
import { ListMessageMoveTasks } from "../actions/ListMessageMoveTasks";
import { ListQueueTags } from "../actions/ListQueueTags";
import { PurgeQueue } from "../actions/PurgeQueue";
import { ReceiveMessage } from "../actions/ReceiveMessage";
import { RemovePermission } from "../actions/RemovePermission";
import { SendMessage } from "../actions/SendMessage";
import { SendMessageBatch } from "../actions/SendMessageBatch";
import { SetQueueAttributes } from "../actions/SetQueueAttributes";
import { StartMessageMoveTask } from "../actions/StartMessageMoveTask";
import { TagQueue } from "../actions/TagQueue";
import { UntagQueue } from "../actions/UntagQueue";
import { UnknownOperation } from "../actions/unknownOperation";
import { SqsError, UnexcpectedList, UnexcpectedObject } from "../common/errors";
import { Queue } from "../lib/queue";
import { isJsObject } from "../common/utils";
import { AWS_DEFAULT_REGION_ENV, AWS_REGION_ENV } from "../common/constants";
import { createQueue } from "../lib/createQueue";

const requestHandler = async (req: IncomingMessage, res: ServerResponse) => {
  const { Action, RequestId, body, foundQueue, isJsonProtocol, QueueUrl, traceId } = await parseSqsHttpRequest(req);

  try {
    if (QueueUrl) {
      if (isJsObject(QueueUrl)) {
        throw UnexcpectedObject;
      }
      if (Array.isArray(QueueUrl)) {
        throw UnexcpectedList;
      }
    }

    switch (Action) {
      case "AddPermission":
        await new AddPermission(req, res, isJsonProtocol, RequestId, body, foundQueue, traceId).exec();
        break;
      case "CancelMessageMoveTask":
        await new CancelMessageMoveTask(req, res, isJsonProtocol, RequestId, body, foundQueue, traceId).exec();
        break;
      case "ChangeMessageVisibility":
        await new ChangeMessageVisibility(req, res, isJsonProtocol, RequestId, body, foundQueue, traceId).exec();
        break;
      case "ChangeMessageVisibilityBatch":
        await new ChangeMessageVisibilityBatch(req, res, isJsonProtocol, RequestId, body, foundQueue, traceId).exec();
        break;
      case "CreateQueue":
        await new CreateQueue(req, res, isJsonProtocol, RequestId, body, foundQueue, traceId).exec();
        break;
      case "DeleteMessage":
        await new DeleteMessage(req, res, isJsonProtocol, RequestId, body, foundQueue, traceId).exec();
        break;
      case "DeleteMessageBatch":
        await new DeleteMessageBatch(req, res, isJsonProtocol, RequestId, body, foundQueue, traceId).exec();
        break;
      case "DeleteQueue":
        await new DeleteQueue(req, res, isJsonProtocol, RequestId, body, foundQueue, traceId).exec();
        break;
      case "GetQueueAttributes":
        await new GetQueueAttributes(req, res, isJsonProtocol, RequestId, body, foundQueue, traceId).exec();
        break;
      case "GetQueueUrl":
        await new GetQueueUrl(req, res, isJsonProtocol, RequestId, body, foundQueue, traceId).exec();
        break;
      case "ListDeadLetterSourceQueues":
        await new ListDeadLetterSourceQueues(req, res, isJsonProtocol, RequestId, body, foundQueue, traceId).exec();
        break;
      case "ListMessageMoveTasks":
        await new ListMessageMoveTasks(req, res, isJsonProtocol, RequestId, body, foundQueue, traceId).exec();
        break;
      case "ListQueues":
        await new ListQueues(req, res, isJsonProtocol, RequestId, body, foundQueue, traceId).exec();
        break;
      case "ListQueueTags":
        await new ListQueueTags(req, res, isJsonProtocol, RequestId, body, foundQueue, traceId).exec();
        break;
      case "PurgeQueue":
        await new PurgeQueue(req, res, isJsonProtocol, RequestId, body, foundQueue, traceId).exec();
        break;
      case "ReceiveMessage":
        await new ReceiveMessage(req, res, isJsonProtocol, RequestId, body, foundQueue, traceId).exec();
        break;
      case "RemovePermission":
        await new RemovePermission(req, res, isJsonProtocol, RequestId, body, foundQueue, traceId).exec();
        break;
      case "SendMessage":
        await new SendMessage(req, res, isJsonProtocol, RequestId, body, foundQueue, traceId).exec();
        break;
      case "SendMessageBatch":
        await new SendMessageBatch(req, res, isJsonProtocol, RequestId, body, foundQueue, traceId).exec();
        break;
      case "SetQueueAttributes":
        await new SetQueueAttributes(req, res, isJsonProtocol, RequestId, body, foundQueue, traceId).exec();
        break;
      case "StartMessageMoveTask":
        await new StartMessageMoveTask(req, res, isJsonProtocol, RequestId, body, foundQueue, traceId).exec();
        break;
      case "TagQueue":
        await new TagQueue(req, res, isJsonProtocol, RequestId, body, foundQueue, traceId).exec();
        break;
      case "UntagQueue":
        await new UntagQueue(req, res, isJsonProtocol, RequestId, body, foundQueue, traceId).exec();
        break;
      default:
        await new UnknownOperation(req, res, isJsonProtocol, RequestId, body, foundQueue, traceId).exec();
        break;
    }
  } catch (error) {
    res.statusCode = 400;

    if (error instanceof SqsError) {
      if (error.statusCode) {
        res.statusCode = error.statusCode;
      }
      if (isJsonProtocol) {
        res.setHeader("x-amzn-query-error", error.getJsonErrorCode());
        res.end(error.toJSON());
      } else {
        res.end(error.toXml(RequestId));
      }
    } else {
      if (isJsonProtocol) {
        res.setHeader("x-amzn-query-error", "UnknownError");
      }

      res.end(SqsError.genericErrorResponse({ RequestId, Message: (error as any).toString?.() ?? "Unknown error" }, isJsonProtocol));
    }
  }
};

type bool = boolean | "true" | "false";
type int = number | `${number}`;

interface InitialQueue {
  QueueName: string;
  Attributes?: {
    FifoQueue?: bool;
    DelaySeconds?: int;
    FifoThroughputLimit?: "perQueue" | "perMessageGroupId";
    ContentBasedDeduplication?: bool;
    DeduplicationScope?: "messageGroup" | "queue";
    KmsDataKeyReusePeriodSeconds?: int;
    KmsMasterKeyId?: string;
    MaximumMessageSize?: int;
    MessageRetentionPeriod?: int;
    ReceiveMessageWaitTimeSeconds?: int;
    VisibilityTimeout?: int;
    RedriveAllowPolicy?: string;
    RedrivePolicy?: string;
    SqsManagedSseEnabled?: bool;
    Policy?: string;
  };
  tags?: Record<string, string>;
}

export interface ISqsServerOptions {
  /**
   * @description (cosmetic) AWS Account Id used in Queue ARN and URL.
   * @default "123456789012"
   */
  accountId?: string;
  /**
   * @example "/@sqs/"
   * @default "/"
   */
  baseUrl?: string;
  /**
   * @description AWS behaviour: If you delete a queue, you must wait at least 60 seconds before creating a queue with the same name.
   * @default true
   */
  emulateQueueCreationLifecycle?: boolean;
  /**
   * @description AWS behaviour: After you create a queue, you must wait at least one second after the queue is created to be able to use the queue.
   * @default false
   */
  emulateLazyQueues?: boolean;

  /**
   * @description DLQ defined in RedrivePolicy must exist.
   * @default true
   */
  validateDlqDestination?: boolean;
  port: number;

  /**
   * @example "sqs.us-east-1.amazonaws.com"
   * @default "localhost"
   */
  hostname?: string;

  /**
   * @description (cosmetic) AWS Region used in Queue ARN.
   * @default "us-east-1"
   */
  region?: string;

  queues?: InitialQueue[];
}

export const createRequestHandler = (options: ISqsServerOptions) => {
  Queue.PORT = options.port;

  if (options.hostname) {
    Queue.HOSTNAME = options.hostname;
  }

  if (typeof options.validateDlqDestination == "boolean") {
    Queue.validateDlqDestination = options.validateDlqDestination;
  }

  if (typeof options.region == "string") {
    Queue.REGION = options.region;
  } else {
    const region = process.env[AWS_REGION_ENV] ?? process.env[AWS_DEFAULT_REGION_ENV];

    if (region) {
      Queue.REGION = region;
    }
  }

  if (typeof options.baseUrl == "string") {
    Queue.BASE_URL = options.baseUrl;
  }

  if (typeof options.emulateQueueCreationLifecycle == "boolean") {
    Queue.emulateQueueCreationLifecycle = options.emulateQueueCreationLifecycle;
  }

  if (typeof options.emulateLazyQueues == "boolean") {
    Queue.emulateLazyQueues = options.emulateLazyQueues;
  }

  if (Array.isArray(options.queues)) {
    for (const q of options.queues) {
      createQueue(q, true);
    }
  }

  return requestHandler;
};
