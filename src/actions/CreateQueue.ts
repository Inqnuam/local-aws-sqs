import { SqsCommand } from "./sqsCommand";
import { ResponseMetadata, xmlVersion, xmlns } from "../common/responses";
import { createQueue } from "../lib/createQueue";

export class CreateQueue extends SqsCommand {
  async exec() {
    const QueueUrl = createQueue(this.reqBody, this.isJsonProtocol);

    this.res.end(this.#createResponse(QueueUrl));
  }

  #createResponse(QueueUrl: string) {
    if (this.isJsonProtocol) {
      return JSON.stringify({ QueueUrl });
    }

    return `${xmlVersion}<CreateQueueResponse ${xmlns}>
    <CreateQueueResult>
      <QueueUrl>${QueueUrl}</QueueUrl>
    </CreateQueueResult>
    ${ResponseMetadata(this.RequestId)}
  </CreateQueueResponse> `;
  }
}
