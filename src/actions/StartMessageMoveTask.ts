import { SqsCommand } from "./sqsCommand";
import { Queue } from "../lib/queue";
import { ResponseMetadata, xmlVersion, xmlns } from "../common/responses";
import {
  InvalidArnException,
  InvalidParameterValueException,
  MalformedInputException,
  MissingParameterException,
  ResourceNotFoundException,
  throwOnNoPrimitiveType,
} from "../common/errors";
import { MAX_MaxNumberOfMessagesPerSecond, MIN_MaxNumberOfMessagesPerSecond } from "../common/constants";
import { getQueueNameFromArn } from "../common/utils";

const InvalidMaxNumberOfMessagesPerSecond = new InvalidParameterValueException(
  "Value for parameter MaxNumberOfMessagesPerSecond is invalid. Reason: You must enter a number that's between 1 and 500."
);

export class StartMessageMoveTask extends SqsCommand {
  async exec() {
    this.#setBody();

    const TaskHandle = this.foundQueue!.startMessageMoveTask(this.body);

    this.res.end(this.#createResponse(TaskHandle));
  }

  #setBody() {
    const { SourceArn, DestinationArn, MaxNumberOfMessagesPerSecond: numberOfMessages } = this.reqBody;

    throwOnNoPrimitiveType(SourceArn);
    throwOnNoPrimitiveType(DestinationArn);
    throwOnNoPrimitiveType(numberOfMessages);

    if (SourceArn === null || typeof SourceArn == "undefined") {
      throw new MissingParameterException("The request must contain the parameter SourceArn.");
    }

    if (!SourceArn || !String(SourceArn).startsWith("arn:aws:sqs:")) {
      throw new InvalidArnException("SourceArn");
    }

    const QueueName = getQueueNameFromArn(SourceArn);

    this.foundQueue = Queue.Queues.find((x) => x.QueueName == QueueName);

    if (!this.foundQueue || Queue.deletingQueues.has(QueueName)) {
      throw new ResourceNotFoundException("The resource that you specified for the SourceArn parameter doesn't exist.");
    }

    const isDlq = Queue.Queues.find((x) => x.RedrivePolicy?.deadLetterTargetArn.endsWith(`:${QueueName}`));

    if (!isDlq) {
      throw new InvalidParameterValueException("Source queue must be configured as a Dead Letter Queue.");
    }

    if (typeof DestinationArn != "undefined") {
      if (!String(DestinationArn).startsWith("arn:aws:sqs:")) {
        throw new InvalidArnException("DestinationArn");
      }

      if (SourceArn == DestinationArn) {
        throw new InvalidParameterValueException("Source queue arn and destination queue arn cannot be the same.");
      }

      const DlqName = getQueueNameFromArn(DestinationArn);

      const destinationdQueue = Queue.Queues.find((x) => x.QueueName == DlqName);

      if (!destinationdQueue) {
        throw new ResourceNotFoundException("The resource that you specified for the DestinationArn parameter doesn't exist.");
      }

      if (this.foundQueue.FifoQueue != destinationdQueue.FifoQueue) {
        throw new InvalidParameterValueException("The source queue and destination queue must be of the same queue type.");
      }
    }

    if (typeof numberOfMessages == "boolean") {
      throw new MalformedInputException(`${String(numberOfMessages).toUpperCase()}_VALUE can not be converted to an Integer`);
    }

    let MaxNumberOfMessagesPerSecond: number | undefined = undefined;

    if (typeof numberOfMessages != "undefined") {
      if (numberOfMessages === 0) {
        throw InvalidMaxNumberOfMessagesPerSecond;
      }
      if (
        numberOfMessages !== null &&
        (numberOfMessages == "" || (typeof numberOfMessages == "string" && (numberOfMessages.includes(" ") || isNaN(numberOfMessages.trim() as unknown as number))))
      ) {
        throw new MalformedInputException("STRING_VALUE can not be converted to an Integer");
      }

      MaxNumberOfMessagesPerSecond = Number(numberOfMessages);
      if (MaxNumberOfMessagesPerSecond < MIN_MaxNumberOfMessagesPerSecond || MaxNumberOfMessagesPerSecond > MAX_MaxNumberOfMessagesPerSecond) {
        throw InvalidMaxNumberOfMessagesPerSecond;
      }
    }

    this.body = { SourceArn, DestinationArn, MaxNumberOfMessagesPerSecond };
  }

  #createResponse(TaskHandle: string) {
    if (this.isJsonProtocol) {
      return JSON.stringify({ TaskHandle });
    }

    return `${xmlVersion}<StartMessageMoveTaskResponse ${xmlns}>
    <StartMessageMoveTaskResult>
        <TaskHandle>${TaskHandle}</TaskHandle>
    </StartMessageMoveTaskResult>
    ${ResponseMetadata(this.RequestId)}
  </StartMessageMoveTaskResponse>`;
  }
}
