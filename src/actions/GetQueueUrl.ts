import { SqsCommand } from "./sqsCommand";
import { InvalidParameterValueException, SqsError } from "../common/errors";
import { ResponseMetadata, xmlVersion, xmlns } from "../common/responses";

export class GetQueueUrl extends SqsCommand {
  async exec() {
    const { QueueName } = this.reqBody;

    if (!QueueName) {
      throw new InvalidParameterValueException("Value for parameter QueueName is invalid. Reason: Must specify a queue name.");
    }

    const foundQueue = this.service.Queues.find((x) => x.QueueName == QueueName);
    if (!foundQueue || this.service.deletingQueues.has(foundQueue.QueueName)) {
      throw new SqsError({
        Code: "AWS.SimpleQueueService.NonExistentQueue",
        Type: "com.amazonaws.sqs#QueueDoesNotExist",
        Message: this.isJsonProtocol ? "The specified queue does not exist." : "The specified queue does not exist for this wsdl version.",
      });
    }

    this.res.end(this.#createResponse(foundQueue.QueueUrl));
  }

  #createResponse(QueueUrl: string) {
    if (this.isJsonProtocol) {
      return JSON.stringify({ QueueUrl });
    }

    return `${xmlVersion}<GetQueueUrlResponse ${xmlns}>
    <GetQueueUrlResult>
      <QueueUrl>${QueueUrl}</QueueUrl>
    </GetQueueUrlResult>
    ${ResponseMetadata(this.RequestId)}
  </GetQueueUrlResponse>`;
  }
}
