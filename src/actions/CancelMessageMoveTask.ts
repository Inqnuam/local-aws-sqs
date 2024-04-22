import { SqsCommand } from "./sqsCommand";
import { Queue } from "../lib/queue";
import { ResponseMetadata, xmlVersion, xmlns } from "../common/responses";
import { InvalidArnException, InvalidParameterValueException, MissingParameterException, ResourceNotFoundException, throwOnNoPrimitiveType } from "../common/errors";
import { getQueueNameFromArn, isJsObject } from "../common/utils";

const InvalidTaskHandleValue = new InvalidParameterValueException("Value for parameter TaskHandle is invalid.");

export class CancelMessageMoveTask extends SqsCommand {
  async exec() {
    this.#setBody();

    const { TaskHandle } = this.body;
    const { taskId, sourceArn } = TaskHandle;

    if (!sourceArn.startsWith("arn:aws:sqs:")) {
      throw new InvalidArnException("SourceArn");
    }

    const QueueName = getQueueNameFromArn(sourceArn);

    this.foundQueue = Queue.Queues.find((x) => x.QueueName == QueueName);

    if (!this.foundQueue || Queue.deletingQueues.has(QueueName)) {
      throw new ResourceNotFoundException("The resource that you specified for the SourceArn parameter doesn't exist.");
    }

    this.res.end(this.#createResponse(this.foundQueue!.cancelMessageMoveTask(taskId)));
  }

  #setBody() {
    const { TaskHandle } = this.reqBody;

    if (typeof TaskHandle == "undefined") {
      throw new MissingParameterException("The request must contain the parameter TaskHandle.");
    }

    if (!TaskHandle) {
      throw new InvalidParameterValueException("The TaskHandle parameter is required.");
    }
    throwOnNoPrimitiveType(TaskHandle);

    if (typeof TaskHandle != "string") {
      throw InvalidTaskHandleValue;
    }

    let parsedTaskHandle;
    try {
      parsedTaskHandle = JSON.parse(Buffer.from(TaskHandle, "base64").toString("utf-8"));
    } catch (error) {
      throw InvalidTaskHandleValue;
    }

    if (!isJsObject(parsedTaskHandle)) {
      throw InvalidTaskHandleValue;
    }

    const { taskId, sourceArn } = parsedTaskHandle;

    if (typeof taskId != "string" || typeof sourceArn != "string") {
      throw InvalidTaskHandleValue;
    }

    this.body = { TaskHandle: parsedTaskHandle };
  }

  #createResponse(ApproximateNumberOfMessagesMoved: number) {
    if (this.isJsonProtocol) {
      return JSON.stringify({ ApproximateNumberOfMessagesMoved });
    }

    return `${xmlVersion}<CancelMessageMoveTaskResponse ${xmlns}>
    <CancelMessageMoveTaskResult>
        <ApproximateNumberOfMessagesMoved>${ApproximateNumberOfMessagesMoved}</ApproximateNumberOfMessagesMoved>
    </CancelMessageMoveTaskResult>
    ${ResponseMetadata(this.RequestId)}
      </CancelMessageMoveTaskResponse>`;
  }
}
